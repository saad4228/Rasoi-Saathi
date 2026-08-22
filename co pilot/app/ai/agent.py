import os

from dotenv import load_dotenv

from google import genai
from google.genai import types

from app.ai.tools import (
    sales_tool,
    profit_tool,
    price_simulation_tool,
    break_even_tool
)


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError(
        "GEMINI_API_KEY not found in .env"
    )


client = genai.Client(
    api_key=api_key
)


# =========================================================
# SYSTEM PROMPT
# =========================================================

SYSTEM_PROMPT = """
You are an AI business assistant for a restaurant manager.

You answer questions about:

- sales
- revenue
- costs
- profit
- profit margin
- pricing
- price changes
- break-even
- business decisions


MULTILINGUAL RULES:

1. Detect the language used by the manager.

2. Answer in the SAME language as the manager.

3. Support:
   - English
   - Hindi
   - Marathi
   - Hinglish
   - other commonly used languages.

4. Keep restaurant product names in their
   original database language when appropriate.


DATA RULES:

1. NEVER invent restaurant numbers.

2. Whenever restaurant data is required,
   ALWAYS use the appropriate database tool.

3. Use get_product_sales for sales questions.

4. Use get_product_profit for:
   - profit
   - revenue
   - cost
   - profit margin

5. Use simulate_price_change for:
   - price increase
   - price decrease
   - price what-if questions

6. Use calculate_break_even when the manager asks:
   - how many sales can fall
   - how many units can be lost
   - maximum quantity loss
   after a price change.

7. Clearly state assumptions.

8. Explain results in simple business language.

9. Use Indian Rupees (₹).

10. If a product does not exist,
    clearly say that the product was not found.

11. Never make up missing data.

12. Show important financial numbers clearly.

13. If the user asks a question that does not
    require restaurant data, answer normally.

14. Do not expose internal tool names,
    database details, or implementation details
    to the manager unless explicitly asked.
"""


# =========================================================
# GEMINI TOOL DECLARATIONS
# =========================================================

tools = [

    types.Tool(

        function_declarations=[

            # =================================================
            # SALES TOOL
            # =================================================

            types.FunctionDeclaration(

                name="get_product_sales",

                description=(
                    "Get the total quantity sold for "
                    "a restaurant product."
                ),

                parameters=types.Schema(

                    type=types.Type.OBJECT,

                    properties={

                        "product_name":
                            types.Schema(

                                type=types.Type.STRING,

                                description=(
                                    "Name of the restaurant "
                                    "product."
                                )
                            )
                    },

                    required=[
                        "product_name"
                    ]
                )
            ),


            # =================================================
            # PROFIT TOOL
            # =================================================

            types.FunctionDeclaration(

                name="get_product_profit",

                description=(
                    "Get selling price, cost price, "
                    "quantity sold, revenue, total cost, "
                    "profit and profit margin for a "
                    "restaurant product."
                ),

                parameters=types.Schema(

                    type=types.Type.OBJECT,

                    properties={

                        "product_name":
                            types.Schema(

                                type=types.Type.STRING,

                                description=(
                                    "Name of the restaurant "
                                    "product."
                                )
                            )
                    },

                    required=[
                        "product_name"
                    ]
                )
            ),


            # =================================================
            # PRICE SIMULATION TOOL
            # =================================================

            types.FunctionDeclaration(

                name="simulate_price_change",

                description=(
                    "Calculate the expected effect of "
                    "changing a product's price on "
                    "quantity and profit."
                ),

                parameters=types.Schema(

                    type=types.Type.OBJECT,

                    properties={

                        "product_name":
                            types.Schema(

                                type=types.Type.STRING,

                                description=(
                                    "Name of the restaurant "
                                    "product."
                                )
                            ),

                        "price_change":
                            types.Schema(

                                type=types.Type.NUMBER,

                                description=(
                                    "Price change in Indian "
                                    "Rupees. For example, "
                                    "20 means increase price "
                                    "by ₹20 and -20 means "
                                    "decrease price by ₹20."
                                )
                            ),

                        "expected_quantity_change_percent":
                            types.Schema(

                                type=types.Type.NUMBER,

                                description=(
                                    "Expected percentage "
                                    "change in quantity sold. "
                                    "For example, -10 means "
                                    "sales are expected to "
                                    "fall by 10 percent."
                                )
                            )
                    },

                    required=[
                        "product_name",
                        "price_change"
                    ]
                )
            ),


            # =================================================
            # BREAK EVEN TOOL
            # =================================================

            types.FunctionDeclaration(

                name="calculate_break_even",

                description=(
                    "Calculate how many units can be lost "
                    "after a price change while maintaining "
                    "the current profit."
                ),

                parameters=types.Schema(

                    type=types.Type.OBJECT,

                    properties={

                        "product_name":
                            types.Schema(

                                type=types.Type.STRING,

                                description=(
                                    "Name of the restaurant "
                                    "product."
                                )
                            ),

                        "price_change":
                            types.Schema(

                                type=types.Type.NUMBER,

                                description=(
                                    "Price change in Indian "
                                    "Rupees."
                                )
                            )
                    },

                    required=[
                        "product_name",
                        "price_change"
                    ]
                )
            )
        ]
    )
]


# =========================================================
# TOOL EXECUTOR
# =========================================================

def execute_tool(
    db,
    function_name,
    arguments,
    restaurant_id=None,
    branch_id=None
):

    # =====================================================
    # SALES
    # =====================================================

    if function_name == "get_product_sales":

        return sales_tool(

            db,

            arguments["product_name"],

            restaurant_id,

            branch_id
        )


    # =====================================================
    # PROFIT
    # =====================================================

    if function_name == "get_product_profit":

        return profit_tool(

            db,

            arguments["product_name"],

            restaurant_id,

            branch_id
        )


    # =====================================================
    # PRICE SIMULATION
    # =====================================================

    if function_name == "simulate_price_change":

        return price_simulation_tool(

            db,

            arguments["product_name"],

            arguments["price_change"],

            arguments.get(
                "expected_quantity_change_percent",
                0
            ),

            restaurant_id,

            branch_id
        )


    # =====================================================
    # BREAK EVEN
    # =====================================================

    if function_name == "calculate_break_even":

        return break_even_tool(

            db,

            arguments["product_name"],

            arguments["price_change"],

            restaurant_id,

            branch_id
        )


    # =====================================================
    # UNKNOWN TOOL
    # =====================================================

    return {
        "error":
            f"Unknown tool: {function_name}"
    }


# =========================================================
# MAIN AGENT
# =========================================================

def run_agent(
    db,
    user_message,
    restaurant_id=None,
    branch_id=None
):

    # =====================================================
    # INITIAL USER MESSAGE
    # =====================================================

    contents = [

        types.Content(

            role="user",

            parts=[

                types.Part(
                    text=user_message
                )
            ]
        )
    ]


    # =====================================================
    # AGENT LOOP
    # =====================================================

    while True:

        response = client.models.generate_content(

            model="gemini-3.1-flash-lite",

            contents=contents,

            config=types.GenerateContentConfig(

                system_instruction=
                    SYSTEM_PROMPT,

                tools=tools
            )
        )


        # =================================================
        # FIND FUNCTION CALLS
        # =================================================

        function_calls = []


        for part in response.candidates[0].content.parts:

            if part.function_call:

                function_calls.append(
                    part.function_call
                )


        # =================================================
        # NO FUNCTION CALL
        # GEMINI HAS FINISHED
        # =================================================

        if not function_calls:

            return response.text


        # =================================================
        # ADD GEMINI RESPONSE TO CONVERSATION
        # =================================================

        contents.append(
            response.candidates[0].content
        )


        # =================================================
        # EXECUTE FUNCTION CALLS
        # =================================================

        tool_parts = []


        for function_call in function_calls:

            function_name = (
                function_call.name
            )


            # ---------------------------------------------
            # GET ARGUMENTS
            # ---------------------------------------------

            arguments = dict(
                function_call.args
            )


            print(
                "\n=============================="
            )

            print(
                f"AI CALLED TOOL: "
                f"{function_name}"
            )

            print(
                f"ARGUMENTS: "
                f"{arguments}"
            )


            # ---------------------------------------------
            # EXECUTE DATABASE TOOL
            # ---------------------------------------------

            result = execute_tool(

                db,

                function_name,

                arguments,

                restaurant_id,

                branch_id
            )


            print(
                f"TOOL RESULT: "
                f"{result}"
            )

            print(
                "=============================="
            )


            # ---------------------------------------------
            # CREATE TOOL RESPONSE
            # ---------------------------------------------

            tool_parts.append(

                types.Part(

                    function_response=
                        types.FunctionResponse(

                            name=function_name,

                            response=result
                        )
                )
            )


        # =================================================
        # SEND TOOL RESULTS BACK TO GEMINI
        # =================================================

        contents.append(

            types.Content(

                role="tool",

                parts=tool_parts
            )
        )