/*
  # Update Votes Policy to Check Eligible Students

  1. Modified Policies
    - Update votes INSERT policy to check if student is eligible for the election
    
  2. Important Notes
    - Students can only vote if they are in the election_eligible_students list
    - This ensures only eligible students can participate in an election
*/

DROP POLICY IF EXISTS "Students can insert votes for open elections" ON votes;

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
    ) AND
    EXISTS (
      SELECT 1 FROM election_eligible_students
      WHERE election_eligible_students.election_id = election_id
      AND election_eligible_students.student_id = auth.uid()
    )
  );