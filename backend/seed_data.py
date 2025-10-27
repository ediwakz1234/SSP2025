"""
Script to seed the database with initial business data
Run this after creating the database: python seed_data.py
"""

from app.core.database import SessionLocal, engine, Base
from app.models.business import Business

# Create tables
Base.metadata.create_all(bind=engine)

# Business data from Brgy. Sta. Cruz, Santa Maria, Bulacan
BUSINESSES = [
    {"business_id": 1, "business_name": "SANTA MARIA 888 Hardware & CONSTRUCTION SUPPLIES", "category": "Hardware", "latitude": 14.83326, "longitude": 120.95468, "street": "Gulod St.", "zone_type": "Commercial"},
    {"business_id": 2, "business_name": "VK Cafe", "category": "Cafe", "latitude": 14.83335, "longitude": 120.95478, "street": "Gulod St.", "zone_type": "Commercial"},
    {"business_id": 3, "business_name": "Reymalyn Loading Station", "category": "Retail", "latitude": 14.8333, "longitude": 120.95497, "street": "Gulod St.", "zone_type": "Commercial"},
    {"business_id": 4, "business_name": "Nanay Mercy & KMS Carwash", "category": "Services", "latitude": 14.8336, "longitude": 120.95501, "street": "Gulod St.", "zone_type": "Commercial"},
    {"business_id": 5, "business_name": "BIGOTE'S MANIHAN", "category": "Restaurant", "latitude": 14.83397, "longitude": 120.95488, "street": "Gulod St.", "zone_type": "Commercial"},
    {"business_id": 6, "business_name": "Dau Motorcycle Shop", "category": "Services", "latitude": 14.83471, "longitude": 120.96503, "street": "Luwasan St.", "zone_type": "Commercial"},
    {"business_id": 7, "business_name": "EDANOZO FURNITURE", "category": "Furniture Store", "latitude": 14.83463, "longitude": 120.95514, "street": "Luwasan St.", "zone_type": "Commercial"},
    {"business_id": 8, "business_name": "Dalen's Store", "category": "Retail", "latitude": 14.83477, "longitude": 120.95515, "street": "Luwasan St.", "zone_type": "Commercial"},
    {"business_id": 9, "business_name": "Heteroza Pizza Pasta Frappe A.T.B.", "category": "Restaurant", "latitude": 14.83486, "longitude": 120.95501, "street": "Luwasan St.", "zone_type": "Commercial"},
    {"business_id": 10, "business_name": "Mr. BREWSKO", "category": "Cafe", "latitude": 14.83515, "longitude": 120.9551, "street": "Luwasan St.", "zone_type": "Commercial"},
    {"business_id": 11, "business_name": "Xyreel's Store", "category": "Retail", "latitude": 14.83558, "longitude": 120.95525, "street": "Centro St.", "zone_type": "Commercial"},
    {"business_id": 12, "business_name": "Centro Eatery", "category": "Restaurant", "latitude": 14.83574, "longitude": 120.95533, "street": "Centro St.", "zone_type": "Commercial"},
    {"business_id": 13, "business_name": "KAF Pharmacy - STA. CRUZ BRANCH", "category": "Pharmacy", "latitude": 14.83591, "longitude": 120.95561, "street": "Centro St.", "zone_type": "Commercial"},
    {"business_id": 14, "business_name": "HAIRCHITECT BARBERSHOP", "category": "Services", "latitude": 14.83619, "longitude": 120.95581, "street": "Centro St.", "zone_type": "Commercial"},
    {"business_id": 15, "business_name": "R.C.S. MINI MART", "category": "Retail", "latitude": 14.83656, "longitude": 120.9552, "street": "Centro St.", "zone_type": "Commercial"},
    {"business_id": 16, "business_name": "SnJ Food Hub", "category": "Restaurant", "latitude": 14.8374, "longitude": 120.95592, "street": "Pag-asa St.", "zone_type": "Commercial"},
    {"business_id": 17, "business_name": "Casa David Private Resort", "category": "Resort", "latitude": 14.83736, "longitude": 120.95666, "street": "Pag-asa St.", "zone_type": "Commercial"},
    {"business_id": 18, "business_name": "D.C. Marianoz Hardware and Construction Supplies", "category": "Hardware", "latitude": 14.83752, "longitude": 120.95728, "street": "Pag-asa St.", "zone_type": "Residential"},
    {"business_id": 19, "business_name": "Shewate Beverages Trading", "category": "Retail", "latitude": 14.83727, "longitude": 120.95581, "street": "Pag-asa St.", "zone_type": "Commercial"},
    {"business_id": 20, "business_name": "JayJays Peanut butter", "category": "Retail", "latitude": 14.83671, "longitude": 120.95762, "street": "Pag-asa St.", "zone_type": "Residential"},
    {"business_id": 21, "business_name": "Idols Sizzlingan Atbp.", "category": "Restaurant", "latitude": 14.83763, "longitude": 120.95888, "street": "Bukid St.", "zone_type": "Commercial"},
    {"business_id": 22, "business_name": "JWNs Talipapa & Sari Sari Store", "category": "Retail", "latitude": 14.83763, "longitude": 120.9582, "street": "Bukid St.", "zone_type": "Commercial"},
    {"business_id": 23, "business_name": "BigBrew Sta. Cruz - Sta. Maria Bulacan", "category": "Cafe", "latitude": 14.83779, "longitude": 120.96005, "street": "Bukid St.", "zone_type": "Commercial"},
    {"business_id": 24, "business_name": "Kambal Inasal", "category": "Restaurant", "latitude": 14.83767, "longitude": 120.96001, "street": "Bukid St.", "zone_type": "Commercial"},
    {"business_id": 25, "business_name": "Crystal World", "category": "Services", "latitude": 14.83768, "longitude": 120.96035, "street": "Bukid St.", "zone_type": "Residential"},
    {"business_id": 26, "business_name": "Boss kleng vape shop", "category": "Retail", "latitude": 14.83448, "longitude": 120.96379, "street": "Matahimik St.", "zone_type": "Residential"},
    {"business_id": 27, "business_name": "Santa Cruz Bully Kennel", "category": "Pet Store", "latitude": 14.83491, "longitude": 120.96222, "street": "Matahimik St.", "zone_type": "Commercial"},
    {"business_id": 28, "business_name": "Sta Cruz 888 Metal Trading and Motor Parts", "category": "Services", "latitude": 14.83491, "longitude": 120.96183, "street": "Matahimik St.", "zone_type": "Residential"},
    {"business_id": 29, "business_name": "MNM Frozen Meat Trading", "category": "Retail", "latitude": 14.83486, "longitude": 120.96158, "street": "Maunlad St.", "zone_type": "Commercial"},
    {"business_id": 30, "business_name": "DM' Food Hub/Double D' Brew", "category": "Cafe", "latitude": 14.83478, "longitude": 120.9616, "street": "Maunlad St.", "zone_type": "Commercial"},
    {"business_id": 31, "business_name": "Cornelio LPG Store", "category": "Retail", "latitude": 14.83557, "longitude": 120.95974, "street": "Maunlad St.", "zone_type": "Residential"},
    {"business_id": 32, "business_name": "ML Photography Studio", "category": "Services", "latitude": 14.83323, "longitude": 120.95969, "street": "Maligaya St.", "zone_type": "Residential"},
    {"business_id": 33, "business_name": "Mg Events Catering Services", "category": "Services", "latitude": 14.83347, "longitude": 120.95886, "street": "Maligaya St.", "zone_type": "Residential"},
    {"business_id": 34, "business_name": "LOLET'S", "category": "Restaurant", "latitude": 14.83197, "longitude": 120.9625, "street": "Mapayapa St.", "zone_type": "Commercial"},
    {"business_id": 35, "business_name": "JLM's STORE", "category": "Retail", "latitude": 14.83183, "longitude": 120.96242, "street": "Mapayapa St.", "zone_type": "Residential"},
    {"business_id": 36, "business_name": "Nessies Store", "category": "Retail", "latitude": 14.83178, "longitude": 120.96252, "street": "Mapayapa St.", "zone_type": "Residential"},
    {"business_id": 37, "business_name": "Blaszas Eatery", "category": "Restaurant", "latitude": 14.83185, "longitude": 120.96281, "street": "Mapayapa St.", "zone_type": "Commercial"},
    {"business_id": 38, "business_name": "Sabon Depot Dealer", "category": "Retail", "latitude": 14.83106, "longitude": 120.96306, "street": "Mapayapa St.", "zone_type": "Commercial"},
    {"business_id": 39, "business_name": "RAYMOND PHONE REPAIR AND CCTV", "category": "Services", "latitude": 14.83713, "longitude": 120.95015, "street": "Sonoma Residences", "zone_type": "Residential"},
    {"business_id": 40, "business_name": "JK' Rebonding and Cellphone Supply Store", "category": "Services", "latitude": 14.83735, "longitude": 120.9505, "street": "Sonoma Residences", "zone_type": "Residential"},
    {"business_id": 41, "business_name": "MELANIO FARM FRESH EGGS - WHOLESALE AND RETAIL", "category": "Retail", "latitude": 14.83785, "longitude": 120.95023, "street": "Sonoma Residences", "zone_type": "Residential"},
    {"business_id": 42, "business_name": "Garage Gym", "category": "Services", "latitude": 14.83868, "longitude": 120.9508, "street": "Sonoma Residences", "zone_type": "Residential"},
    {"business_id": 43, "business_name": "BNC STORE", "category": "Retail", "latitude": 14.8373, "longitude": 120.95092, "street": "Sonoma Residences", "zone_type": "Residential"},
    {"business_id": 44, "business_name": "Vicky's Cakes and Pastries", "category": "Bakery", "latitude": 14.83802, "longitude": 120.95583, "street": "Housing Project", "zone_type": "Commercial"},
    {"business_id": 45, "business_name": "YANI'S LECHON MANOK", "category": "Retail", "latitude": 14.83812, "longitude": 120.95599, "street": "Housing Project", "zone_type": "Commercial"},
    {"business_id": 46, "business_name": "Sandra Store", "category": "Retail", "latitude": 14.83918, "longitude": 120.95609, "street": "Housing Project", "zone_type": "Commercial"},
    {"business_id": 47, "business_name": "MONTREAL BATTERY SHOP", "category": "Services", "latitude": 14.83953, "longitude": 120.95625, "street": "Housing Project", "zone_type": "Commercial"},
    {"business_id": 48, "business_name": "Lots'A Pizza Fuel Hub", "category": "Restaurant", "latitude": 14.83975, "longitude": 120.95638, "street": "Housing Project", "zone_type": "Commercial"},
    {"business_id": 49, "business_name": "SilkshopManila STA.MARIA BULACAN", "category": "Retail", "latitude": 14.84021, "longitude": 120.95641, "street": "Provincial Road", "zone_type": "Commercial"},
    {"business_id": 50, "business_name": "DRD Construction Supply", "category": "Hardware", "latitude": 14.84048, "longitude": 120.95643, "street": "Provincial Road", "zone_type": "Commercial"},
    {"business_id": 51, "business_name": "Jhos Food House", "category": "Restaurant", "latitude": 14.84085, "longitude": 120.95633, "street": "Provincial Road", "zone_type": "Commercial"},
    {"business_id": 52, "business_name": "RLM MEAT SHOP", "category": "Retail", "latitude": 14.84089, "longitude": 120.95635, "street": "Provincial Road", "zone_type": "Commercial"},
    {"business_id": 53, "business_name": "RDC Auto parts and hydraulic hose repair center", "category": "Services", "latitude": 14.84122, "longitude": 120.95639, "street": "Provincial Road", "zone_type": "Commercial"},
    {"business_id": 54, "business_name": "Jollens Peanut butter", "category": "Retail", "latitude": 14.84026, "longitude": 120.95443, "street": "Matimyas St.", "zone_type": "Commercial"},
    {"business_id": 55, "business_name": "Body Transformers Gym", "category": "Services", "latitude": 14.84011, "longitude": 120.95516, "street": "Matimyas St.", "zone_type": "Residential"},
    {"business_id": 56, "business_name": "Rehydrate Water Refilling Station", "category": "Services", "latitude": 14.84064, "longitude": 120.95496, "street": "Matimyas St.", "zone_type": "Residential"},
    {"business_id": 57, "business_name": "XZDK Lumber and trading", "category": "Hardware", "latitude": 14.83721, "longitude": 120.95593, "street": "Provincial Road", "zone_type": "Commercial"},
    {"business_id": 58, "business_name": "Villa Anju Private Resort", "category": "Resort", "latitude": 14.83779, "longitude": 120.9569, "street": "Pag asa St.", "zone_type": "Commercial"},
    {"business_id": 59, "business_name": "3Dr Poultry Supply", "category": "Retail", "latitude": 14.84266, "longitude": 120.9566, "street": "Provincial Road", "zone_type": "Commercial"},
    {"business_id": 60, "business_name": "Tacia's Store", "category": "Retail", "latitude": 14.84012, "longitude": 120.95516, "street": "Provincial Road", "zone_type": "Commercial"},
]

def seed_businesses():
    db = SessionLocal()
    
    try:
        # Check if data already exists
        existing_count = db.query(Business).count()
        if existing_count > 0:
            print(f"Database already contains {existing_count} businesses. Skipping seed.")
            return
        
        # Add all businesses
        for business_data in BUSINESSES:
            business = Business(**business_data)
            db.add(business)
        
        db.commit()
        print(f"Successfully seeded {len(BUSINESSES)} businesses!")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Seeding database...")
    seed_businesses()
