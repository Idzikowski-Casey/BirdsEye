/*
SQL statement for changing 
*/
WITH A AS(
    SELECT id, :col_name "col_name" FROM column_groups WHERE col_group_id = :col_group_id
)
UPDATE ${project_schema}.columns c
SET col_name = A.col_name,
    col_group = A.id
FROM A
WHERE c.id = :id;