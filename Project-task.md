Take-Home Project: Build an AI Voice Agent Tool (Simplified)
Objective: Your task is to build a functional web application that allows a non-technical administrator to configure, test, and review calls made by an adaptive AI voice agent. The project centers on creating an intuitive UI for three core functions: configuring the agent's logic, triggering test calls, and analyzing the structured results.
Part 1: Core Requirements & Technology Stack
You are to build a web application using React, FastAPI, and Supabase. You will use Retell AI for the voice system (you have to make a new account yourself). The application you build must meet the following requirements for its administrative user:
Agent Configuration UI: The application must provide a simple UI that allows an administrator to define the prompts and logic that guide the agent's conversations.
Call Triggering & Results UI: From the dashboard, the administrator must be able to:
Enter the driver's name, phone number, and the relevant load number into fields to provide context for the call.
Click a "Start Test Call" button to trigger a phone call from the configured voice agent.
After the call is complete, view the results in a structured format. This summary should present the key information collected during the call as key-value pairs, alongside the full call transcript.
Backend Logic: Your FastAPI backend will serve as the webhook for Retell AI, containing the logic to interpret the prompts from the database and guide the agent's conversation in real-time. Your backend must also include a post-processing step to structure the raw transcript into the summary displayed in the UI.
Part 2: Project Task - Implement and Test Logistics Agents
The web application you build will be used to implement and test the two logistics agent scenarios detailed below.
Task A: Implement Optimal Voice Configuration Your agent configurations should demonstrate best practices for a realistic voice experience. In your implementation, you must make use of Retell AI's advanced settings, such as backchanneling, filler words, and interruption sensitivity, to make the agent sound as human-like as possible.
Scenario 1: Logistics - Driver Check-in ("Dispatch")
Context: The agent is calling a driver about a specific load (e.g., Mike, Load #7891-B). The system knows the load's details but does not know the driver's current status.
Goal: Configure the agent to handle the check-in conversation. The agent must first determine the driver's status by asking an open-ended question like, "Hi Mike, this is Dispatch with a check call on load 7891-B. Can you give me an update on your status?" Based on the driver's response, the agent must dynamically pivot its line of questioning.
Structured Data to Collect (Success Case): Your system's post-processing must extract and display the following data:
call_outcome: "In-Transit Update" OR "Arrival Confirmation"
driver_status: "Driving" OR "Delayed" OR "Arrived"
current_location: (e.g., "I-10 near Indio, CA")
eta: (e.g., "Tomorrow, 8:00 AM")
Scenario 2: Logistics - Emergency Protocol ("Dispatch")
Context: The agent is in the middle of a routine check call when the driver interrupts with an emergency (e.g., "I just had a blowout, I'm pulling over").
Goal: Configure your system so the agent can immediately abandon its standard conversation thread in response to an emergency trigger phrase. It must gather critical information and then end the call by stating that a human dispatcher will call them back immediately.
Structured Data to Collect (Success Case): In an emergency, the structured summary must contain:
call_outcome: "Emergency Detected"
emergency_type: "Accident" OR "Breakdown" OR "Medical" OR "Other"
emergency_location: (e.g., "I-15 North, Mile Marker 123")
escalation_status: "Escalation Flagged"
Task B: Implement Dynamic Response Handling Your implementation must also gracefully handle the following special cases:
The Uncooperative Driver: The agent should be able to probe for more information when given one-word answers and know when to end the call if the driver remains unresponsive.
The Noisy Environment: The agent should be able to handle garbled speech-to-text results by asking the driver to repeat themselves a limited number of times before ending the call.
Deliverables
A link to a Git repository containing your complete, functional web application.
A short, unlisted video (e.g., Loom) demonstrating your application. Show how an administrator would configure an agent, trigger a call, and view the results for one of the scenarios.
A brief README.md in your repository explaining your design choices and how to run the application.
Retell API: DO NOT EXPOSE OR YOUR CANDIDACY WILL NOT BE CONSIDERED


Full-Stack AI Voice Agent Tool for Logistics (Corrected to Original Scope)
Task: Build a functional, full-stack web application that allows a non-technical administrator to configure, test, and review calls made by an adaptive AI voice agent. The project centers on creating an intuitive UI for three core functions: configuring the agent's logic, triggering test calls, and analyzing the structured results.
1. Core Requirements & Technology Stack
Backend: FastAPI (Python)
Frontend: React
Database: Supabase
AI Voice Service: Retell AI
AI Logic/LLM: OpenAI API
2. Frontend (React)
Primary Dashboard: A single, clean interface for the administrator.
Agent Configuration UI: A simple UI that allows the administrator to define the prompts and logic that guide the agent's conversations. This should be a user-editable field, not a hardcoded prompt.
Call Triggering:
Enter the driver's name, phone number, and the relevant load number into fields.
Click a "Start Test Call" button to trigger a phone call from the configured voice agent.
Call Review:
View a history of past calls.
For each call, display the structured data summary (key-value pairs) and the full call transcript.
3. Backend (FastAPI)
Core Logic: The backend will serve as the webhook for Retell AI, interpreting the dynamic prompts from the database and guiding the conversation in real-time.
Call Triggering Endpoint: An API endpoint that your React app calls to initiate the phone call via Retell AI.
Retell AI Webhook: The essential webhook to handle the live conversation by sending driver speech to OpenAI and relaying the LLM's response back to Retell.
Database Integration (Supabase):
Store the user-defined agent configuration (prompts and logic).
Log the results of each completed call, including the transcript and the structured data summary.
Post-call Data Processing: After a call is complete, your backend must process the full transcript to extract the structured JSON summary. This logic should be robust enough to handle the requirements for both scenarios below.
4. AI Component (OpenAI & Retell Integration)
Two Conversational Scenarios: Your system must handle both scenarios detailed below.
Scenario 1: Logistics - Driver Check-in ("Dispatch")
Context: The agent calls a driver (e.g., Mike) about a specific load (e.g., #7891-B) to get a status update.
Goal: The agent asks an open-ended question ("Can you give me an update on your status?") and dynamically pivots its line of questioning based on the driver's response.
Structured Data to Collect (Success Case): The post-call summary must extract and display:
call_outcome: "In-Transit Update" OR "Arrival Confirmation"
driver_status: "Driving" OR "Delayed" OR "Arrived"
current_location: (e.g., "I-10 near Indio, CA")
eta: (e.g., "Tomorrow, 8:00 AM")
Scenario 2: Logistics - Emergency Protocol ("Dispatch")
Context: The driver interrupts with an emergency (e.g., "I just had a blowout").
Goal: The agent must immediately abandon its standard conversation, gather critical information, and end the call by stating a human dispatcher will call them back.
Structured Data to Collect (Success Case): In an emergency, the summary must contain:
call_outcome: "Emergency Detected"
emergency_type: "Accident" OR "Breakdown" OR "Medical" OR "Other"
emergency_location: (e.g., "I-15 North, Mile Marker 123")
escalation_status: "Escalation Flagged"
Dynamic Response Handling: The agent must be able to handle special cases:
The Uncooperative Driver: Probe for more information after one-word answers. End the call if the driver remains unresponsive.
The Noisy Environment: Ask the driver to repeat themselves a limited number of times before ending the call.
Realistic Voice: Tune the Retell AI settings (e.g., backchanneling, filler words, and interruption sensitivity) to make the agent sound as human-like as possible.
5. Deliverables
Git Repository: A link to your complete, functional web application.
README.md: A brief README.md explaining your design choices and how to run the application.
Video Demonstration: A short, unlisted video (e.g., Loom) demonstrating how an administrator would configure an agent, trigger a call, and view the results for one of the scenarios.
key_5beaa584012a000dc5d0c94a8bee

---
based on the past chat  we are devloping the project. 
udnerstand the first thing before we jump in directly to make everrything. 
---
first create the retell AI and webhook to create an agent and to trigger a call to test if it is working. 
then we will use the backend GPT Prompt to ask the questions?
this is the first thing we should make?
3. Backend (FastAPI)
Core Logic: The backend will serve as the webhook for Retell AI, interpreting the dynamic prompts from the database and guiding the conversation in real-time.
Call Triggering Endpoint: An API endpoint that your React app calls to initiate the phone call via Retell AI.
Retell AI Webhook: The essential webhook to handle the live conversation by sending driver speech to OpenAI and relaying the LLM's response back to Retell.
Database Integration (Supabase):
Store the user-defined agent configuration (prompts and logic).
Log the results of each completed call, including the transcript and the structured data summary.
Post-call Data Processing: After a call is complete, your backend must process the full transcript to extract the structured JSON summary. This logic should be robust enough to handle the requirements for both scenarios below.

----
at the same time we are working. we will test at the same time.  so our task is to use retell AI with our custome LLM gpt. 
Retell AI Webhook: The essential webhook to handle the live conversation by sending driver speech to OpenAI and relaying the LLM's response back to Retell.
---
then make the final summary.md once backend and retell is working. 
with LLM. 
raad these documentsl
@https://docs.retellai.com/general/introduction 
@https://docs.retellai.com/api-references/create-phone-call 
@https://docs.retellai.com/api-references/create-phone-number 
@https://docs.retellai.com/api-references/create-agent 
so if we have make unncessary things we can remove it. 
as the plan roadmap was too and had unnessary things. so for now forget the roadmap. 
and focus. 
---
@Project-task.md 

@Project scope and roadmap discussion 
