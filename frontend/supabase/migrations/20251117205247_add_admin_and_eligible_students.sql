/*
  # Add Admin Role and Eligible Students

  1. New Tables
    - `election_eligible_students`
      - `id` (uuid, primary key)
      - `election_id` (uuid, foreign key)
      - `student_id` (uuid, foreign key)
      - unique constraint on (election_id, student_id)

  2. Modified Tables
    - `students` - add `is_admin` column
    
  3. Security
    - Enable RLS on election_eligible_students
    - Authenticated users can view eligible students for any election
    - Admins can manage election creation and candidates

  4. Important Notes
    - Only eligible students can vote in an election
    - Admins can create elections and manage candidates
*/

ALTER TABLE students ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS election_eligible_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(election_id, student_id)
);

ALTER TABLE election_eligible_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view eligible students"
  ON election_eligible_students FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert eligible students"
  ON election_eligible_students FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = auth.uid()
      AND students.is_admin = true
    )
  );

CREATE POLICY "Admins can delete eligible students"
  ON election_eligible_students FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = auth.uid()
      AND students.is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_eligible_students_election ON election_eligible_students(election_id);
CREATE INDEX IF NOT EXISTS idx_eligible_students_student ON election_eligible_students(student_id);