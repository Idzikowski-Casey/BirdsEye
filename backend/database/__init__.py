from sqlalchemy.ext.automap import automap_base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from pathlib import Path

#from settings import DATABASE
from utils import run_sql, config_check, run_docker_config, delete_config, id_check
from sql_formatter import SqlFormatter

here = Path(__file__).parent
fixtures = here / "fixtures"
procedures = here / "procedures"

################# SQL files #############################
clear_project_data_sql = procedures / "clear_project_data.sql"
project_insert_sql = procedures / "project_insert.sql"
project_insert_no_location = procedures / "project_insert_no_loc.sql"
create_view_sql = fixtures / "views.sql"
create_core_table = fixtures / "project_schema_tables.sql"
on_project_insert_sql = procedures / "on_project_insert.sql"
redump_linework_sql = procedures / "redump-linework-from-edge-data.sql"
remove_project_schema = procedures / "remove_project_schema.sql"
project_info_insert = procedures / "project-meta-insert.sql"
project_table = fixtures / "projects_table.sql"


prod_url = "postgresql://postgres:@db:5432/geologic_map"
class Database:
    """ 
    Database class with built in SQL Formatter
    """

    def __init__(self, project = None):
        self.project_id = getattr(project, "id", None)
        self.engine = create_engine(prod_url, echo=True)
        self.Session = sessionmaker(bind=self.engine)
        self.config = config_check(project)
        self.formatter = SqlFormatter(self.project_id)
    
    def run_sql(self, sql, params={}, **kwargs):
        sql = self.formatter.sql_config_format(sql, self.config)
        return run_sql(sql, params=params, session=self.Session(), **kwargs)

    def run_sql_file(self, sql_file, params={}, **kwargs):
        sql = open(sql_file).read()

        return self.run_sql(sql, params=params, **kwargs)
    
    def exec_query(self, filename_or_query, **kwargs):
        """
            Returns a Pandas DataFrame from a SQL query
            need to pass query as sql
        """
        from pandas import read_sql        
    
        if "SELECT" in str(filename_or_query):
            # We are working with a query string instead of
            # an SQL file.
            sql = filename_or_query
            sql = self.formatter.sql_config_format(sql, self.config)
        else:
            with open(filename_or_query) as f:
                sql = f.read()
            sql = self.formatter.sql_config_format(sql, self.config)

        return read_sql(sql, self.engine, **kwargs)
    
    #################### db initialization methods ##########################
    def create_project_table(self):
        self.run_sql_file(project_table)
              
    #################### db procedure methods ###############################
    def create_project_schema(self):
        # need to run docker command and then create core tables
        run_docker_config(self.project_id, "create_tables")
        self.run_sql_file(create_core_table)
        self.create_map_face_view()
    
    def clear_project_data(self):
        self.run_sql_file(clear_project_data_sql)
    
    def insert_project_data(self, params={}, no_location = False):
        if no_location:
            self.run_sql_file(project_insert_no_location, params=params)
        else:
            self.run_sql_file(project_insert_sql, params=params)
    
    def insert_project_info(self, params={}):
        self.run_sql_file(project_info_insert, params=params)
    
    def insert_project_column_group(self, params={}):
        sql = """INSERT INTO ${project_schema}.column_groups(col_group_id, col_group, col_group_name) VALUES(
            :col_group_id, :col_group, :col_group_name);"""
        self.run_sql(sql, params)

    def on_project_insert(self):
        self.run_sql_file(on_project_insert_sql)
    
    def create_map_face_view(self):
        self.run_sql_file(create_view_sql)
    
    def redump_linework_from_edge(self):
        self.run_sql_file(redump_linework_sql)

    def remove_project(self, params={}):
        run_docker_config(self.project_id, "delete") # delete topology
        self.run_sql_file(remove_project_schema, params={"project_id": self.project_id}) 
        delete_config(self.project_id) # remove config file

    ################## db topology methods ##############################

    def update_topology(self):
        run_docker_config(self.project_id, "update")

    ###################### Project-Free methods ########################
    
    def get_project_info(self):
        query = "SELECT * FROM projects;"
        return self.exec_query(query).to_dict(orient="records")
    
    def get_next_project_id(self):
        """ function to get the next project id that won't conflict with macrostrat """
        # TODO: unhardcode the max int for project id
        sql = '''SELECT max(project_id), 'imported' origin from projects WHERE project_id < 50
                 UNION ALL
                 SELECT max(project_id), 'all' origin from projects;'''

        data = self.exec_query(sql).to_dict(orient='records')
        imported_max_id = data[0]['max']
        all_max_id = data[1]['max']
        if imported_max_id == all_max_id:
            return imported_max_id + 1000
        else:
            return all_max_id + 1
    def get_next_col_group_id(self):
        """ function to get the next project id that won't conflict with macrostrat """
        # TODO: unhardcode the max int for project id
        # WARNING: Now this isn't going to be conflict free. Because we split the tables up
        sql = '''SELECT max(col_group_id), 'imported' origin from ${project_schema}.column_groups WHERE col_group_id < 5000
                 UNION ALL
                 SELECT max(col_group_id), 'all' origin from ${project_schema}.column_groups;'''

        data = self.exec_query(sql).to_dict(orient='records')
        imported_max_id = data[0]['max']
        all_max_id = data[1]['max']
        if imported_max_id is None or all_max_id is None:
            return 5000
        if imported_max_id == all_max_id:
            return imported_max_id + 5000
        else:
            return all_max_id + 1