from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    location = Column(String)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"))

    name = Column(String)
    category = Column(String)

    selling_price = Column(Float)
    cost_price = Column(Float)


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"))

    date = Column(DateTime)
    total_amount = Column(Float)


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True)

    sale_id = Column(Integer, ForeignKey("sales.id"))
    product_id = Column(Integer, ForeignKey("products.id"))

    quantity = Column(Integer)
    price = Column(Float)


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True)

    restaurant_id = Column(Integer, ForeignKey("restaurants.id"))

    category = Column(String)
    amount = Column(Float)
    date = Column(DateTime)


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True)

    product_id = Column(Integer, ForeignKey("products.id"))

    quantity = Column(Float)