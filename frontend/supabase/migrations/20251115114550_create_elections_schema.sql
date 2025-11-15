/*
  # Elections System Schema

  1. New Tables
    - `students`
      - `id` (uuid, primary key) - linked to auth.users
      - `email` (text, unique) - student email
      - `full_name` (text) - student name
      - `created_at` (timestamp)
    
    - `elections`
      - `id` (uuid, primary key)
      - `title` (text) - election title
      - `description` (text) - election description
      - `start_date` (timestamp) - when voting opens
      - `end_date` (timestamp) - when voting closes
      - `status` (text) - 'upcoming', 'open', 'closed'
      - `created_at` (timestamp)
    
    - `candidates`
      - `id` (uuid, primary key)
      - `election_id` (uuid, foreign key)
      - `name` (text) - candidate name
      - `description` (text) - candidate description
      - `photo_url` (text) - optional photo
      - `created_at` (timestamp)
    
    - `votes`
      - `id` (uuid, primary key)
      - `election_id` (uuid, foreign key)
      - `student_id` (uuid, foreign key)
      - `candidate_id` (uuid, foreign key)
      - `created_at` (timestamp)
      - unique constraint on (election_id, student_id)

  2. Security
    - Enable RLS on all tables
    - Students can read their own profile
    - Students can view all elections and candidates
    - Students can create votes for open elections (one per election)
    - Students can view their own votes
    - Only authenticated students can access the system

  3. Important Notes
    - Each student can vote once per election
    - Votes are immutable once cast
    - Results are calculated by counting votes per candidate
    - Elections status is managed by dates
*/

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own profile"
  ON students FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Students can insert own profile"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Students can update own profile"
  ON students FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS elections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE elections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all elections"
  ON elections FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  photo_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all candidates"
  ON candidates FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(election_id, student_id)
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own votes"
  ON votes FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert votes for open elections"
  ON votes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (
      SELECT 1 FROM elections 
      WHERE elections.id = election_id 
      AND elections.status = 'open'
      AND elections.start_date <= now()
      AND elections.end_date >= now()
    )
  );

CREATE INDEX IF NOT EXISTS idx_votes_election ON votes(election_id);
CREATE INDEX IF NOT EXISTS idx_votes_student ON votes(student_id);
CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates(election_id);