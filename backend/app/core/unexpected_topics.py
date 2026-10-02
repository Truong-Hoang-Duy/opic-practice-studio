"""
"Unexpected" (random) topics of the real OPIc: everyday subjects the learner did NOT pick in the survey
(hair salons, weather, hotels, dentists, banks...). Every generated test gets one unexpected combo (Q8-Q10)
and a role-play scenario (Q11-Q13) from a different domain, drawn here in code so tests really vary
(an LLM left to choose keeps returning the same few topics).
"""
import json
import random
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Sources: OPIc test-taker reports / prep courses ("돌발 주제": banks, hospitals, hotels, public transport, weather,
# recycling, health, holidays, geography, appointments, the internet, industry...), plus everyday settings that
# suit Vietnamese learners (traditional markets, street food, ride-hailing apps, storm season).
# label: exact topic label the generator must use; domain: groups related subjects (topic and role-play
# never share a domain); keywords: survey words meaning the learner already chose it (then it is not "unexpected")
UNEXPECTED_TOPICS: List[Dict[str, Any]] = [
    {"label": "Hair & Hair Salons", "domain": "beauty", "keywords": ["hair", "salon"]},
    {"label": "Weather & Seasons", "domain": "weather", "keywords": ["weather", "season"]},
    {"label": "Hotels", "domain": "travel", "keywords": ["hotel"]},
    {"label": "Dentists & Dental Care", "domain": "health", "keywords": ["dentist", "dental"]},
    {"label": "Doctors & Hospitals", "domain": "health", "keywords": ["doctor", "hospital", "clinic"]},
    {"label": "Banks & Banking", "domain": "finance", "keywords": ["bank"]},
    {"label": "Holidays & Festivals", "domain": "holidays", "keywords": ["holiday", "festival", "tet"]},
    {"label": "Furniture", "domain": "home", "keywords": ["furniture"]},
    {"label": "Home Appliances", "domain": "home", "keywords": ["appliance"]},
    {"label": "Recycling", "domain": "environment", "keywords": ["recycl"]},
    {"label": "Public Transportation", "domain": "transport", "keywords": ["transport", "bus", "subway", "metro"]},
    {"label": "Mobile Phones", "domain": "technology", "keywords": ["phone", "smartphone"]},
    {"label": "The Internet", "domain": "technology", "keywords": ["internet", "social media"]},
    {"label": "Restaurants & Eating Out", "domain": "food", "keywords": ["restaurant", "eating out"]},
    {"label": "Clothing & Fashion", "domain": "shopping", "keywords": ["fashion", "clothes", "clothing"]},
    {"label": "Shopping Malls & Stores", "domain": "shopping", "keywords": ["shopping", "mall"]},
    {"label": "Geography of Your Country", "domain": "country", "keywords": ["geography"]},
    {"label": "Neighborhoods & Neighbors", "domain": "home", "keywords": ["neighbor", "neighbourhood", "neighborhood"]},
    {"label": "Staying Healthy", "domain": "health", "keywords": ["healthy", "health", "diet"]},
    {"label": "Family & Friends Gatherings", "domain": "social", "keywords": ["gathering", "party", "parties"]},
    {"label": "Pets", "domain": "pets", "keywords": ["pet", "dog", "cat"]},
    {"label": "Libraries", "domain": "education", "keywords": ["library", "libraries"]},
    {"label": "Household Chores", "domain": "home", "keywords": ["chore", "housework", "cleaning"]},
    {"label": "Airports & Flights", "domain": "travel", "keywords": ["airport", "flight", "overseas"]},
    {"label": "Cars & Driving", "domain": "transport", "keywords": ["car", "driving"]},
    {"label": "Industries in Your Country", "domain": "country", "keywords": ["industry", "industries"]},
    {"label": "Technology & Gadgets", "domain": "technology", "keywords": ["gadget", "technology"]},
    {"label": "Childhood Memories", "domain": "social", "keywords": ["childhood"]},
    {"label": "Cooking at Home", "domain": "food", "keywords": ["cook"]},
    {"label": "Shoes & Accessories", "domain": "shopping", "keywords": ["shoes", "accessor"]},
    # --- frequent "unexpected" sets reported by recent OPIc test takers ---
    {"label": "Appointments & Making Plans", "domain": "social", "keywords": ["appointment"]},
    {"label": "Free Time & Weekends", "domain": "social", "keywords": ["free time", "weekend"]},
    {"label": "Your Hometown", "domain": "country", "keywords": ["hometown"]},
    {"label": "Housing in Your Country", "domain": "home", "keywords": ["housing"]},
    {"label": "Natural Disasters & Storms", "domain": "weather", "keywords": ["disaster", "storm", "flood", "typhoon"]},
    {"label": "Energy Saving at Home", "domain": "environment", "keywords": ["energy", "electricity"]},
    {"label": "Traffic & Commuting", "domain": "transport", "keywords": ["traffic", "commut"]},
    {"label": "Taxis & Ride-Hailing Apps", "domain": "transport", "keywords": ["taxi", "grab", "ride"]},
    {"label": "Bicycles & Motorbikes", "domain": "transport", "keywords": ["bicycl", "bike", "motorbike", "cycling"]},
    {"label": "Online Shopping & Deliveries", "domain": "shopping", "keywords": ["online shopping", "delivery", "deliveries"]},
    {"label": "Traditional Markets", "domain": "shopping", "keywords": ["market"]},
    {"label": "Street Food", "domain": "food", "keywords": ["street food"]},
    {"label": "Food Delivery Apps", "domain": "food", "keywords": ["food delivery"]},
    {"label": "Coffee Shops", "domain": "food", "keywords": ["coffee", "cafe", "café"]},
    {"label": "Social Media", "domain": "technology", "keywords": ["social media", "facebook", "tiktok", "instagram"]},
    {"label": "News & Getting Information", "domain": "technology", "keywords": ["news"]},
    {"label": "Online Learning", "domain": "education", "keywords": ["online learning", "online course"]},
    {"label": "Schools & Education in Your Country", "domain": "education", "keywords": ["school", "education"]},
    {"label": "Books & Reading", "domain": "education", "keywords": ["book", "reading"]},
    {"label": "Movies & TV Shows", "domain": "entertainment", "keywords": ["movie", "film", "tv", "cinema"]},
    {"label": "Music", "domain": "entertainment", "keywords": ["music", "song", "concert"]},
    {"label": "Museums & Galleries", "domain": "entertainment", "keywords": ["museum", "gallery", "galleries"]},
    {"label": "Cameras & Taking Photos", "domain": "technology", "keywords": ["camera", "photo"]},
    {"label": "Pharmacies & Medicine", "domain": "health", "keywords": ["pharmac", "medicine"]},
    {"label": "Sleep & Daily Habits", "domain": "health", "keywords": ["sleep"]},
    {"label": "Plants & Gardening", "domain": "home", "keywords": ["plant", "garden"]},
    {"label": "Weddings & Celebrations", "domain": "holidays", "keywords": ["wedding", "celebrat"]},
    {"label": "Gifts & Birthdays", "domain": "holidays", "keywords": ["gift", "birthday"]},
    {"label": "Volunteering", "domain": "social", "keywords": ["volunteer"]},
    {"label": "Working from Home", "domain": "work", "keywords": ["work from home", "working from home", "remote"]},
]

ROLE_PLAY_SCENARIOS: List[Dict[str, Any]] = [
    {"label": "Hotel Reservation", "domain": "travel", "setup": "book a hotel room for an upcoming trip", "keywords": ["hotel"]},
    {"label": "Dentist Appointment", "domain": "health", "setup": "make an appointment at a dental clinic because of a toothache", "keywords": ["dentist"]},
    {"label": "Hair Salon Booking", "domain": "beauty", "setup": "book a haircut at a new hair salon", "keywords": ["hair", "salon"]},
    {"label": "Opening a Bank Account", "domain": "finance", "setup": "open a new account at a bank", "keywords": ["bank"]},
    {"label": "Car Rental", "domain": "transport", "setup": "rent a car for a weekend trip", "keywords": ["car"]},
    {"label": "Furniture Delivery", "domain": "home", "setup": "buy a sofa and arrange its delivery", "keywords": ["furniture"]},
    {"label": "Phone Repair Shop", "domain": "technology", "setup": "get a broken smartphone repaired", "keywords": ["phone"]},
    {"label": "Travel Agency", "domain": "holidays", "setup": "plan a holiday package with a travel agency", "keywords": ["travel agency"]},
    {"label": "Restaurant Reservation", "domain": "food", "setup": "reserve a table for a family celebration", "keywords": ["restaurant"]},
    {"label": "Apartment Rental", "domain": "home", "setup": "ask about an apartment that is for rent", "keywords": ["rent"]},
    {"label": "Concert Tickets", "domain": "social", "setup": "buy tickets for a concert", "keywords": ["concert"]},
    {"label": "Airline Flight Change", "domain": "travel", "setup": "change the date of a flight", "keywords": ["flight", "airline"]},
    {"label": "Returning Clothes", "domain": "shopping", "setup": "exchange or return clothes bought at a store", "keywords": ["clothes", "clothing"]},
    {"label": "Doctor's Clinic", "domain": "health", "setup": "make an appointment at a clinic because you feel sick", "keywords": ["doctor", "clinic"]},
    {"label": "Internet Service Provider", "domain": "technology", "setup": "sign up for a new home internet plan", "keywords": ["internet"]},
    {"label": "Language School", "domain": "education", "setup": "sign up for an English course at a language school", "keywords": ["course", "class"]},
    {"label": "Pet Care Service", "domain": "pets", "setup": "find someone to look after a friend's pet while they travel", "keywords": ["pet"]},
    {"label": "Moving Company", "domain": "home", "setup": "hire a moving company to move to a new apartment", "keywords": ["moving"]},
    {"label": "Gym Membership", "domain": "health", "setup": "join a gym near your home", "keywords": ["gym", "fitness"]},
    {"label": "Birthday Party Planning", "domain": "social", "setup": "plan a surprise birthday party for a friend", "keywords": ["party"]},
    {"label": "Pharmacy Visit", "domain": "health", "setup": "buy medicine at a pharmacy for a bad cold", "keywords": ["pharmac"]},
    {"label": "Post Office Package", "domain": "shopping", "setup": "send a package overseas at the post office", "keywords": ["post office"]},
    {"label": "Online Store Inquiry", "domain": "shopping", "setup": "ask an online store about an order you placed", "keywords": ["online shopping"]},
    {"label": "Air Conditioner Repair", "domain": "home", "setup": "get a repair technician to fix your air conditioner", "keywords": ["repair"]},
    {"label": "Talking to a Neighbor", "domain": "home", "setup": "talk to your neighbor about planning a quiet weekend in the building", "keywords": ["neighbor"]},
    {"label": "Taxi to the Airport", "domain": "transport", "setup": "book a taxi to the airport for an early flight", "keywords": ["taxi", "grab"]},
    {"label": "Bike Rental", "domain": "transport", "setup": "rent bicycles for a day trip around the city", "keywords": ["bike", "bicycl"]},
    {"label": "Library Membership", "domain": "education", "setup": "get a library card and borrow some books", "keywords": ["library"]},
    {"label": "Museum Tour Booking", "domain": "entertainment", "setup": "book a guided tour at a museum for a group of friends", "keywords": ["museum"]},
    {"label": "Movie Night Plans", "domain": "entertainment", "setup": "buy movie tickets for you and a friend", "keywords": ["movie", "cinema"]},
    {"label": "Cooking Class", "domain": "food", "setup": "sign up for a weekend cooking class", "keywords": ["cook"]},
    {"label": "Photo Studio", "domain": "technology", "setup": "book a photo session at a studio for a family photo", "keywords": ["photo"]},
    {"label": "Wedding Gift", "domain": "holidays", "setup": "choose and order a wedding gift for a coworker", "keywords": ["wedding"]},
    {"label": "Visiting a Sick Friend", "domain": "health", "setup": "ask a friend's family about visiting them in the hospital", "keywords": ["hospital"]},
    {"label": "Volunteer Program", "domain": "social", "setup": "join a weekend volunteer program at a local charity", "keywords": ["volunteer"]},
    {"label": "Co-working Space", "domain": "work", "setup": "rent a desk at a co-working space for a month", "keywords": ["co-working", "coworking"]},
]


def _survey_text(survey_data: Optional[Dict[str, Any]]) -> str:
    return json.dumps(survey_data or {}, ensure_ascii=False).lower()


def _in_survey(item: Dict[str, Any], survey: str) -> bool:
    return any(k in survey for k in item["keywords"])


def pick_unexpected(
    survey_data: Optional[Dict[str, Any]] = None,
    avoid_labels: Iterable[str] = (),
    rng: Optional[random.Random] = None,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    (unexpected topic for Q8-Q10, role-play scenario for Q11-Q13): not something the learner chose in the
    survey, not used in their recent tests (avoid_labels), and from two different domains.
    """
    rng = rng or random.Random()
    survey = _survey_text(survey_data)
    avoid = {a.strip().lower() for a in avoid_labels if a}

    def pool(items):
        fresh = [i for i in items if not _in_survey(i, survey) and i["label"].lower() not in avoid]
        return fresh or [i for i in items if not _in_survey(i, survey)] or list(items)

    topic = rng.choice(pool(UNEXPECTED_TOPICS))
    scenarios = [s for s in pool(ROLE_PLAY_SCENARIOS) if s["domain"] != topic["domain"]] or ROLE_PLAY_SCENARIOS
    return topic, rng.choice(scenarios)
