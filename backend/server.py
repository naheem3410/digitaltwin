from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os
from dotenv import load_dotenv
from typing import Optional, List, Dict
import json
import uuid
from datetime import datetime
import boto3
from botocore.exceptions import ClientError
from context import prompt
from utilities.settings import Settings
from utilities.models import Model
from utilities.tools import ToolCreation, Tool, Property, Parameter
from utilities.notifications import Notification
import json
from typing import Any

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)



# Memory storage configuration
USE_S3 = os.getenv("USE_S3", "false").lower() == "true"
S3_BUCKET = os.getenv("S3_BUCKET", "")
MEMORY_DIR = os.getenv("MEMORY_DIR", "../memory")

# Initialize S3 client if needed
if USE_S3:
    s3_client = boto3.client("s3")


# Request/Response models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


class Message(BaseModel):
    role: str
    content: str
    timestamp: str

#start here

tool = ToolCreation()
notification = Notification()

cvs = tool.read_pdf("./data/knowledge")
vector_store = tool.create_embeddings(cvs);

name = "Naheem"
full_name = "Naheem Quadri"

get_availability_tool = Tool(
    name="get_cal_availability",
    description="Check for available meeting slots on the calendar for a specific date range.",
    parameters=Parameter(
        properties=[
            Property(
                name="start_date",
                type="string",
                description="The start date to check in YYYY-MM-DD format.",
            ),
            Property(
                name="end_date",
                type="string",
                description="The end date to check in YYYY-MM-DD format.",
            ),
        ],
        required=["start_date", "end_date"],
    ),
)

send_email_tool = Tool(
    name="send_email",
    description=f"""Send an email notification to {name}. 
    For new visitor emails, only call this AFTER the user has explicitly provided 
    their name and email address in the conversation. Never call with empty or unknown values.""",
    parameters=Parameter(
        properties=[
            Property(
                name="subject",
                type="string",
                description="The subject line of the email.",
            ),
            Property(
                name="message",
                type="string",
                description="The body content of the email to send. Must include the user's name and email address.",
            ),
        ],
        required=["subject", "message"],
    ),
)



tool.create_tool(get_availability_tool, tool.get_cal_availability)
custom_tool = tool.create_tool(send_email_tool, notification.send_email)

print(f"Tools registered: {[t['function']['name'] for t in custom_tool]}")




#end here

# Memory management functions
def get_memory_path(session_id: str) -> str:
    return f"{session_id}.json"


def load_conversation(session_id: str) -> List[Dict]:
    """Load conversation history from storage"""
    if USE_S3:
        try:
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=get_memory_path(session_id))
            return json.loads(response["Body"].read().decode("utf-8"))
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return []
            raise
    else:
        # Local file storage
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                return json.load(f)
        return []


def save_conversation(session_id: str, messages: List[Dict]):
    """Save conversation history to storage"""
    if USE_S3:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=get_memory_path(session_id),
            Body=json.dumps(messages, indent=2),
            ContentType="application/json",
        )
    else:
        # Local file storage
        os.makedirs(MEMORY_DIR, exist_ok=True)
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        with open(file_path, "w") as f:
            json.dump(messages, f, indent=2)


@app.get("/")
async def root():
    return {
        "message": "AI Digital Twin API",
        "memory_enabled": True,
        "storage": "S3" if USE_S3 else "local",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "use_s3": USE_S3}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
       
        session_id = request.session_id or str(uuid.uuid4())

        # Load conversation history
        conversation = load_conversation(session_id)

        contextual_data = "\n\n".join(tool.retrieve_context(request.message))
        messages = [{"role": "system", "content": prompt(contextual_data, name, full_name)}]

        # Add conversation history (keep last 10 messages)
        for msg in conversation:
            messages.append({"role": msg["role"], "content": msg["content"]})

        
        messages.append({"role": "user", "content": request.message})

        
        model = Model(type="openai")

        #tool calling loop
        done = False
        response = None
        loop_count = 0
        max_loops = 5  #prevent infinite loops

        while not done and loop_count < max_loops:
            loop_count += 1

            
            response = model.get_model(
                model_name="gpt-4o-mini",
                messages=messages,
                tools=custom_tool
            )

            choice = response.choices[0]
            finish_reason = choice.finish_reason
            assistant_message = choice.message

            print(f"finish_reason: {finish_reason}")

            
            messages.append({
                "role": "assistant",
                "content": assistant_message.content,
                "tool_calls": getattr(assistant_message, "tool_calls", None)
            })

            
            tool_calls = getattr(assistant_message, "tool_calls", None)
            if finish_reason == "tool_calls" and tool_calls:
                tool_results = []

                for tool_call in tool_calls:
                    try:
                        # Get tool name and args
                        function = getattr(tool_call, "function", None)
                        if function:
                            tool_name = function.name
                            raw_args = function.arguments
                        else:
                            tool_name = getattr(tool_call, "name", None)
                            raw_args = getattr(tool_call, "arguments", "{}")

                    
                        try:
                            tool_args = json.loads(raw_args)
                        except Exception as e:
                            print("JSON ERROR:", e, raw_args)
                            continue

                        
                        result = tool.handle_tool_call(tool_name, tool_args)

                        tool_results.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": result
                        })

                    except Exception as e:
                        print("TOOL ERROR:", e)
                        continue

                messages.extend(tool_results)
            else:
                done = True

        if response is None:
            raise RuntimeError("No response generated from model.")

        assistant_response = response.choices[0].message.content

        
        conversation.append({
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now().isoformat()
        })
        conversation.append({
            "role": "assistant",
            "content": assistant_response,
            "timestamp": datetime.now().isoformat()
        })

       
        save_conversation(session_id, conversation)

        return ChatResponse(response=assistant_response, session_id=session_id)

    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversation/{session_id}")
async def get_conversation(session_id: str):
    """Retrieve conversation history"""
    try:
        conversation = load_conversation(session_id)
        return {"session_id": session_id, "messages": conversation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)