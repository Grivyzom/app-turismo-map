SELECT 
    id, 
    name, 
    email, 
    user_type, 
    status, 
    created_at
FROM 
    public.users
ORDER BY 
    created_at DESC
LIMIT 10;