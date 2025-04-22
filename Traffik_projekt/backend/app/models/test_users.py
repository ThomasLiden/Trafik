from supabase_client import supabase

def get_users():
    result = supabase.table("users").select("*").execute()
    print(result.data)

get_users()


