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


# ==========================================
# LOAD ENVIRONMENT VARIABLES
# ==========================================

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError(
        "GEMINI_API_KEY not found in .env"
    )


# ==========================================
# GEMINI CLIENT
# ==========================================

client = genai.Client(
    api_key=api_key
)


# ==========================================
# SYSTEM PROMPT
# ==========================================

SYSTEM_PROMPT = """
You are an AI business assistant for a restaurant manager.

You answer questions about:

- sales
- revenue
- costs
- profit
- pricing
- price changes
- break-even points

Rules:

1. Never invent restaurant numbers.

2. Whenever restaurant data is required,
   use the appropriate tool.

3. Use get_product_sales for sales questions.

4. Use get_product_profit for profit,
   revenue, cost or margin questions.

5. Use simulate_price_change for price
   what-if questions.

6. Use calculate_break_even when the
   manager asks how much sales can fall
   after a price change.

7. Clearly state assumptions.

8. Explain results in simple business
   language.

9. Use Indian Rupees (₹).

10. If a product does not exist,
    clearly say so.

11. Never make up missing data.
"""


# ==========================================
# GEMINI TOOLS
# ==========================================

tools = [

    types.Tool(
        function_declarations=[

            # --------------------------------
            # SALES
            # --------------------------------

            types.FunctionDeclaration(
                name="get_product_sales",

                description=(
                    "Get total quantity sold "
                    "for a restaurant product."
                ),

                parameters=types.Schema(
                    type=types.Type.OBJECT,

                    properties={
                        "product_name": types.Schema(
                            type=types.Type.STRING,
                            description=(
                                "Name of the restaurant product"
                            )
                        )
                    },

                    required=[
                        "product_name"
                    ]
                )
            ),

            # --------------------------------
            # PROFIT
            # --------------------------------

            types.FunctionDeclaration(
                name="get_product_profit",

                description=(
                    "Get selling price, cost price, "
                    "quantity sold, revenue, total cost, "
                    "profit and profit margin."
                ),

                parameters=types.Schema(
                    type=types.Type.OBJECT,

                    properties={
                        "product_name": types.Schema(
                            type=types.Type.STRING,
                            description=(
                                "Name of the restaurant product"
                            )
                        )
                    },

                    required=[
                        "product_name"
                    ]
                )
            ),

            # --------------------------------
            # PRICE SIMULATION
            # --------------------------------

            types.FunctionDeclaration(
                name="simulate_price_change",

                description=(
                    "Calculate the effect of changing "
                    "a product's price on expected profit."
                ),

                parameters=types.Schema(
                    type=types.Type.OBJECT,

                    properties={

                        "product_name": types.Schema(
                            type=types.Type.STRING,
                            description=(
                                "Name of the restaurant product"
                            )
                        ),

                        "price_change": types.Schema(
                            type=types.Type.NUMBER,
                            description=(
                                "Price change in rupees. "
                                "20 means increase by ₹20. "
                                "-10 means decrease by ₹10."
                            )
                        ),

                        "expected_quantity_change_percent":
                            types.Schema(
                                type=types.Type.NUMBER,
                                description=(
                                    "Expected percentage change "
                                    "in quantity sold. "
                                    "-10 means sales decrease by 10%."
                                )
                            )
                    },

                    required=[
                        "product_name",
                        "price_change"
                    ]
                )
            ),

            # --------------------------------
            # BREAK EVEN
            # --------------------------------

            types.FunctionDeclaration(
                name="calculate_break_even",

                description=(
                    "Calculate how many units can be lost "
                    "after a price change while maintaining "
                    "the current total profit."
                ),

                parameters=types.Schema(
                    type=types.Type.OBJECT,

                    properties={

                        "product_name": types.Schema(
                            type=types.Type.STRING,
                            description=(
                                "Name of the restaurant product"
                            )
                        ),

                        "price_change": types.Schema(
                            type=types.Type.NUMBER,
                            description=(
                                "Price change in rupees"
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


# ==========================================
# TOOL EXECUTOR
# ==========================================

def execute_tool(
    db,
    function_name,
    arguments
):

    if function_name == "get_product_sales":

        return sales_tool(
            db,
            arguments["product_name"]
        )


    elif function_name == "get_product_profit":

        return profit_tool(
            db,
            arguments["product_name"]
        )


    elif function_name == "simulate_price_change":

        return price_simulation_tool(

            db,

            arguments["product_name"],

            arguments["price_change"],

            arguments.get(
                "expected_quantity_change_percent",
                0
            )
        )


    elif function_name == "calculate_break_even":

        return break_even_tool(

            db,

            arguments["product_name"],

            arguments["price_change"]
        )


    else:

        return {
            "error":
                f"Unknown tool: {function_name}"
        }


# ==========================================
# MAIN AGENT
# ==========================================

def run_agent(
    db,
    user_message
):

    # --------------------------------------
    # Initial user message
    # --------------------------------------

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


    # --------------------------------------
    # Agent loop
    # --------------------------------------

    while True:

        # ----------------------------------
        # Ask Gemini
        # ----------------------------------

        response = client.models.generate_content(

            model="gemini-3.1-flash-lite",

            contents=contents,

            config=types.GenerateContentConfig(

                system_instruction=
                    SYSTEM_PROMPT,

                tools=tools
            )
        )


        # ----------------------------------
        # Find function calls
        # ----------------------------------

        function_calls = []


        for part in response.candidates[0].content.parts:

            if part.function_call:

                function_calls.append(
                    part.function_call
                )


        # ----------------------------------
        # No function call
        # Gemini has final answer
        # ----------------------------------

        if not function_calls:

            return response.text


        # ----------------------------------
        # Add Gemini response to history
        # ----------------------------------

        contents.append(
            response.candidates[0].content
        )


        # ----------------------------------
        # Execute tools
        # ----------------------------------

        tool_parts = []


        for function_call in function_calls:

            # Get function name
            function_name = (
                function_call.name
            )


            # IMPORTANT:
            # Get arguments BEFORE printing them
            arguments = dict(
                function_call.args
            )


            # Debug information
            print(
                f"\nAI CALLED TOOL: "
                f"{function_name}"
            )

            print(
                f"ARGUMENTS: "
                f"{arguments}"
            )


            # Execute the selected tool
            result = execute_tool(

                db,

                function_name,

                arguments
            )


            # Print result for debugging
            print(
                f"TOOL RESULT: "
                f"{result}"
            )


            # --------------------------------
            # Send tool result to Gemini
            # --------------------------------

            tool_parts.append(

                types.Part(

                    function_response=
                        types.FunctionResponse(

                            name=function_name,

                            response=result
                        )
                )
            )


        # ----------------------------------
        # Add tool results to conversation
        # ----------------------------------

        contents.append(

            types.Content(

                role="tool",

                parts=tool_parts
            )
        )