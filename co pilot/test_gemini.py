from app.database import SessionLocal
from app.ai.agent import run_agent


db = SessionLocal()


question = (
    "What happens to my profit if I "
    "increase Chicken Biryani price by "
    "20 rupees?"
)


try:

    answer = run_agent(
        db,
        question
    )

    print("\n==============================")
    print("AI ANSWER")
    print("==============================")
    print(answer)


finally:

    db.close()