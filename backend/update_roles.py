from uuid import UUID
from sqlalchemy import select
from app.database import SessionLocal
from app.models.restaurant import Restaurant
from app.models.user import User

def main():
    db = SessionLocal()
    restaurant_id = UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a001")
    restaurant = db.scalar(select(Restaurant).where(Restaurant.id == restaurant_id))
    print("Configuring users for restaurant:", restaurant.name)

    # 1. Owner: Sambodhi Bhowal
    owner_id = UUID("bfb5c22c-5166-4e35-9930-b54755ef0fa8")
    owner = db.scalar(select(User).where(User.id == owner_id))
    if owner:
        owner.name = "Sambodhi Bhowal"
        owner.email = "sambodhibhowal@gmail.com"
        owner.role = "owner"
        owner.restaurant_id = restaurant_id
        owner.is_active = True
    else:
        owner = User(
            id=owner_id,
            restaurant_id=restaurant_id,
            email="sambodhibhowal@gmail.com",
            name="Sambodhi Bhowal",
            role="owner",
            is_active=True,
        )
        db.add(owner)

    # 2. Chef: 6af7d9ca-3fb5-4be2-b75b-626ad65b9957
    chef_id = UUID("6af7d9ca-3fb5-4be2-b75b-626ad65b9957")
    chef = db.scalar(select(User).where(User.id == chef_id))
    if chef:
        chef.name = "Head Chef"
        chef.role = "chef"
        chef.restaurant_id = restaurant_id
        chef.is_active = True
    else:
        chef = User(
            id=chef_id,
            restaurant_id=restaurant_id,
            email="chef@saffronjunction.demo",
            name="Head Chef",
            role="chef",
            is_active=True,
        )
        db.add(chef)

    # 3. Waiter: e1a4072c-db6a-446d-81c0-640e71a08bb4
    waiter_id = UUID("e1a4072c-db6a-446d-81c0-640e71a08bb4")
    waiter = db.scalar(select(User).where(User.id == waiter_id))
    if waiter:
        waiter.name = "Main Waiter"
        waiter.role = "waiter"
        waiter.restaurant_id = restaurant_id
        waiter.is_active = True
    else:
        waiter = User(
            id=waiter_id,
            restaurant_id=restaurant_id,
            email="waiter@saffronjunction.demo",
            name="Main Waiter",
            role="waiter",
            is_active=True,
        )
        db.add(waiter)

    db.commit()

    print("\n--- Active Restaurant Users ---")
    for u in db.scalars(select(User).where(User.restaurant_id == restaurant_id)).all():
        print(f"Role: {u.role:<8} | Name: {u.name:<18} | ID: {u.id} | Email: {u.email}")

if __name__ == "__main__":
    main()
