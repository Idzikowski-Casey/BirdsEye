-- SELECT ST_AsGeoJSON(ST_MakeValid(ST_LineMerge(geometry))) lines, id from ${data_schema}.linework;
SELECT ST_AsGeoJSON(geometry) lines, id from ${data_schema}.linework;