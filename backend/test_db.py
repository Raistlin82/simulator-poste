from database import SessionLocal
from crud import get_master_data

db = SessionLocal()
m = get_master_data(db)
print(m.prof_certs_resources)
