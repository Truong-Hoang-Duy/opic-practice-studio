"""
Curated question banks and Vietnamese step guides for OPIc simulation.
"""

from typing import Dict, List, Any

SAMPLE_PRE_TEST_QUESTION = {
    "question_text": "Hello! Welcome to the OPIc Practice Studio. Before we begin the actual test, let's do a quick warm-up. Can you introduce yourself briefly and describe what the weather is like today where you are?",
    "topic": "Warm-up & System Check",
    "question_type": "warm_up",
    "difficulty": "IM",
    "vietnamese_guide": {
        "overview": "Đây là câu hỏi thử nghiệm để kiểm tra âm thanh tai nghe và microphone.",
        "target_pattern": "Greeting -> Name/Job -> Weather description -> Wrap-up",
        "steps": [
            {"step_number": 1, "title": "Greeting & Identity", "hint_vi": "Chào hỏi và giới thiệu tên, hiện đang làm gì.", "example_phrases": ["Hello Eva, nice to meet you.", "My name is... and I am currently working as..."]},
            {"step_number": 2, "title": "Weather Description", "hint_vi": "Miêu tả thời tiết hôm nay thế nào.", "example_phrases": ["Today the weather is quite pleasant...", "It's a bit hot and humid outside..."]},
            {"step_number": 3, "title": "Closing", "hint_vi": "Khép lại và sẵn sàng cho bài thi.", "example_phrases": ["I feel ready for the test today.", "That's a quick overview!"]}
        ],
        "recommended_vocabulary": ["pleasant", "chilly", "humid", "sunny", "ready"],
        "sample_sentence_starters": ["Hi Eva, my name is...", "Right now outside, the weather is..."]
    }
}

# Q1 is always this self-introduction. Like the real OPIc it is a warm-up and is NOT scored.
SELF_INTRO_QUESTION = {
    "order_index": 1,
    "question_text": "Let's start the interview now. Tell me something about yourself. What is your name, what do you do, and what are some things you enjoy doing in your free time?",
    "question_type": "self_intro",
    "topic": "Personal Background",
    "difficulty": "IM",
    "vietnamese_guide": {
        "overview": "Câu 1 luôn là Giới thiệu bản thân (Self-introduction). Hãy nói trôi chảy, tự nhiên trong khoảng 60-90 giây.",
        "target_pattern": "Greeting -> Name/Job/Major -> Living/Hometown -> Hobbies/Leisure -> Friendly wrap-up",
        "steps": [
            {"step_number": 1, "title": "Warm Greeting & Name", "hint_vi": "Chào Eva, giới thiệu tên và công việc/ngành học.", "example_phrases": ["Hello Eva, it's a pleasure to take this test today. My name is Alex, and I am currently working as a software developer."]},
            {"step_number": 2, "title": "Living Environment", "hint_vi": "Sống ở đâu, với ai.", "example_phrases": ["I was born and raised in Hanoi, but currently I reside in a lively neighborhood."]},
            {"step_number": 3, "title": "Interests & Passions", "hint_vi": "Sở thích và thời gian rảnh rỗi.", "example_phrases": ["When I'm off the clock, I'm passionate about jogging around West Lake and brewing specialty coffee."]},
            {"step_number": 4, "title": "Conclusion", "hint_vi": "Kết lại và chào mừng buổi phỏng vấn.", "example_phrases": ["That's a brief snapshot of who I am. I'm excited for our conversation!"]}
        ],
        "recommended_vocabulary": ["pleasure to meet you", "currently residing", "off the clock", "passionate about", "snapshot"],
        "sample_sentence_starters": ["First of all, my name is...", "In my spare time, I often..."]
    }
}

TOPIC_QUESTIONS_BANK = {
    "environment": [
        {
            "type": "description",
            "text": "Environmental protection is an important issue today. Can you describe what kinds of environmental problems your country or city is facing?",
            "guide": {
                "overview": "Miêu tả thực trạng vấn đề môi trường tại thành phố hoặc quốc gia của bạn.",
                "target_pattern": "General statement -> Major Issue 1 (Air/Plastic) -> Major Issue 2 (Traffic/Waste) -> Closing opinion",
                "steps": [
                    {"step_number": 1, "title": "Opening", "hint_vi": "Nêu nhận định chung về môi trường hiện nay.", "example_phrases": ["To be honest, environmental issues have become a pressing concern in my city."]},
                    {"step_number": 2, "title": "Detail 1: Air & Traffic Pollution", "hint_vi": "Nêu vấn đề khí thải, bụi mịn từ xe cộ.", "example_phrases": ["One of the most noticeable issues is air quality due to heavy motorbike exhaust."]},
                    {"step_number": 3, "title": "Detail 2: Plastic Waste", "hint_vi": "Nêu thực trạng rác thải nhựa một lần.", "example_phrases": ["Another big problem is single-use plastics from takeaway drinks and food."]},
                    {"step_number": 4, "title": "Personal Action / Closing", "hint_vi": "Kết luận và hành động cá nhân để bảo vệ môi trường.", "example_phrases": ["I try to bring my own tumbler and bag to reduce waste every day."]}
                ],
                "recommended_vocabulary": ["pressing concern", "fine dust", "exhaust fumes", "single-use plastic", "eco-friendly"],
                "sample_sentence_starters": ["In my opinion, environmental pollution is...", "The most visible issue is..."]
            }
        },
        {
            "type": "past_experience",
            "text": "Have you ever participated in an environmental activity or taken steps to protect the environment? Tell me about a specific time, what happened, and any challenges you faced.",
            "guide": {
                "overview": "Kể lại một trải nghiệm thực tế bạn tham gia bảo vệ môi trường, có tình huống khó khăn (complication) để đạt IH.",
                "target_pattern": "Context (When/Where) -> What you did -> Complication (unexpected challenge) -> Resolution -> Feeling",
                "steps": [
                    {"step_number": 1, "title": "Opening & Context", "hint_vi": "Khi nào, ở đâu bạn tham gia hoạt động đó.", "example_phrases": ["I vividly remember last summer when I joined a community clean-up drive."]},
                    {"step_number": 2, "title": "Actions taken", "hint_vi": "Các việc bạn đã làm (quá khứ đơn).", "example_phrases": ["We gathered early in the morning and sorted recyclable plastics along the beach."]},
                    {"step_number": 3, "title": "Complication (Quan trọng cho IH!)", "hint_vi": "Sự cố bất ngờ phát sinh (mưa to, thiếu găng tay, rác quá nhiều).", "example_phrases": ["However, out of nowhere, heavy rain started pouring and some trash bags tore apart."]},
                    {"step_number": 4, "title": "Resolution & Lesson", "hint_vi": "Cách giải quyết và cảm nghĩ rút ra.", "example_phrases": ["We quickly supported each other, found backup tarps, and finished successfully. It was exhausting but memorable."]}
                ],
                "recommended_vocabulary": ["clean-up drive", "sorted recyclables", "out of nowhere", "tore apart", "rewarding experience"],
                "sample_sentence_starters": ["Speaking of environmental efforts, I remember a time when...", "The biggest obstacle was..."]
            }
        },
        {
            "type": "comparison",
            "text": "How have people's attitudes toward environmental protection changed compared to the past? Compare the past with the present.",
            "guide": {
                "overview": "So sánh thái độ bảo vệ môi trường giữa quá khứ và hiện tại (rèn luyện thì quá khứ vs hiện tại).",
                "target_pattern": "Past habit -> Shift / Turning point -> Present awareness & lifestyle -> Future outlook",
                "steps": [
                    {"step_number": 1, "title": "Past Habit", "hint_vi": "Trong quá khứ, mọi người ít quan tâm thế nào.", "example_phrases": ["In the past, people rarely paid attention to recycling or eco-friendly habits."]},
                    {"step_number": 2, "title": "Change & Reason", "hint_vi": "Yếu tố thúc đẩy sự thay đổi (mạng xã hội, giáo dục).", "example_phrases": ["However, over the past few years, extensive media campaigns raised widespread awareness."]},
                    {"step_number": 3, "title": "Current Lifestyle", "hint_vi": "Hiện tại người trẻ làm gì (túi vải, phân loại rác).", "example_phrases": ["Nowadays, carrying reusable cups and sorting trash have become trendy daily habits."]}
                ],
                "recommended_vocabulary": ["in the past vs nowadays", "widespread awareness", "reusable alternatives", "sustainable lifestyle"],
                "sample_sentence_starters": ["A decade ago, most people didn't think much about...", "These days, there is a clear paradigm shift..."]
            }
        }
    ],
    "human_rights": [
        {
            "type": "description",
            "text": "Human rights and equality in daily life are frequently discussed today. What comes to mind when you think of human rights, particularly in work or school settings?",
            "guide": {
                "overview": "Trình bày suy nghĩ về quyền con người và sự bình đẳng trong công sở hoặc trường học.",
                "target_pattern": "Core definition -> Workplace equality -> Respect for diversity -> Conclusion",
                "steps": [
                    {"step_number": 1, "title": "Opening Statement", "hint_vi": "Khái niệm quyền con người với bản thân.", "example_phrases": ["When it comes to human rights, I immediately think of equal opportunities and mutual respect."]},
                    {"step_number": 2, "title": "Workplace / School Context", "hint_vi": "Bình đẳng cơ hội, không phân biệt đối xử.", "example_phrases": ["In the workplace, everyone deserves fair wages, safe conditions, and freedom from discrimination."]},
                    {"step_number": 3, "title": "Voice and Open Feedback", "hint_vi": "Quyền được bày tỏ ý kiến mà không sợ hãi.", "example_phrases": ["Employees should feel safe speaking up and sharing innovative thoughts without fear of reprisal."]}
                ],
                "recommended_vocabulary": ["equal opportunity", "mutual respect", "discrimination", "fair compensation", "speak up"],
                "sample_sentence_starters": ["To me, human rights in everyday life mean...", "In a professional environment, this translates to..."]
            }
        },
        {
            "type": "past_experience",
            "text": "Tell me about a situation at work, school, or in your community where fairness or equal treatment was challenged, and how it was resolved.",
            "guide": {
                "overview": "Kể câu chuyện về một bất công hoặc mâu thuẫn đối xử và cách tháo gỡ (Complication narrative).",
                "target_pattern": "Background context -> Unfair situation -> Action / Discussion -> Positive resolution",
                "steps": [
                    {"step_number": 1, "title": "Incident Background", "hint_vi": "Hoàn cảnh xảy ra sự việc tại cơ quan/nhóm học tập.", "example_phrases": ["I recall an experience when we were working on an intensive project at my company."]},
                    {"step_number": 2, "title": "The Complication", "hint_vi": "Sự bất hợp lý về phân chia khối lượng việc hoặc credit.", "example_phrases": ["One junior colleague did enormous ground work, but their contribution was almost overlooked during presentation."]},
                    {"step_number": 3, "title": "Intervention & Fairness", "hint_vi": "Hành động lên tiếng hoặc họp lại để công bằng.", "example_phrases": ["I decided to speak up privately to our team leader to ensure fair recognition for everyone."]}
                ],
                "recommended_vocabulary": ["overlooked", "contribution", "team dynamic", "transparent conversation", "fair credit"],
                "sample_sentence_starters": ["Back when I was handling a group project...", "The challenge arose when..."]
            }
        }
    ],
    "global_workplace": [
        {
            "type": "description",
            "text": "Many people today work in international environments or work remotely with global colleagues. Describe what a typical global workplace looks like and what skills are essential.",
            "guide": {
                "overview": "Miêu tả môi trường làm việc toàn cầu/remote và các kỹ năng cần thiết.",
                "target_pattern": "Overview of global workplace -> Communication tools & dynamics -> Key skills (English, cultural empathy) -> Closing",
                "steps": [
                    {"step_number": 1, "title": "Overview", "hint_vi": "Tổng quan về xu thế làm việc toàn cầu và linh hoạt.", "example_phrases": ["A modern global workplace is characterized by cross-border collaboration and flexible remote arrangements."]},
                    {"step_number": 2, "title": "Tools & Dynamics", "hint_vi": "Các công cụ phối hợp xuyên biên giới.", "example_phrases": ["Teams coordinate via Zoom, Slack, and cloud platforms across completely different time zones."]},
                    {"step_number": 3, "title": "Critical Competencies", "hint_vi": "Kỹ năng cần có: giao tiếp rõ ràng và hiểu văn hóa.", "example_phrases": ["Beyond fluent English, cultural empathy and proactive communication are paramount."]}
                ],
                "recommended_vocabulary": ["cross-border collaboration", "time zone differences", "cultural empathy", "proactive communication"],
                "sample_sentence_starters": ["In today's globalized economy...", "The biggest requirement for working globally is..."]
            }
        },
        {
            "type": "past_experience",
            "text": "Tell me about a memorable experience you had collaborating with someone from a different background, department, or country. What went well, and what was challenging?",
            "guide": {
                "overview": "Kể lại một trải nghiệm hợp tác đa văn hóa hoặc liên phòng ban, có khó khăn bất ngờ và cách vượt qua.",
                "target_pattern": "Project introduction -> Miscommunication/Obstacle -> How you solved it -> What you learned",
                "steps": [
                    {"step_number": 1, "title": "Project Setup", "hint_vi": "Dự án là gì và đối tác đến từ đâu.", "example_phrases": ["A while ago, I collaborated on a software launch with partners based in Singapore and Europe."]},
                    {"step_number": 2, "title": "The Complication", "hint_vi": "Bất đồng về múi giờ hoặc phong cách giao tiếp.", "example_phrases": ["Initially, differing time zones caused delays, and a critical bug appeared just hours before release."]},
                    {"step_number": 3, "title": "Solution & Teamwork", "hint_vi": "Họp khẩn cấp và phân chia trách nhiệm.", "example_phrases": ["We organized an emergency video sync, mapped out clear ownership, and resolved the issue seamlessly."]}
                ],
                "recommended_vocabulary": ["software launch", "differing time zones", "critical bug", "emergency sync", "ownership"],
                "sample_sentence_starters": ["I once worked on a joint initiative with...", "Everything went smoothly until..."]
            }
        }
    ],
    "socio_cultural": [
        {
            "type": "comparison",
            "text": "There are noticeable cultural differences between older and younger generations today. Compare how the older generation and younger generation spend their free time or view career success.",
            "guide": {
                "overview": "So sánh góc nhìn giữa thế hệ đi trước và thế hệ trẻ (rất phổ biến trong OPIc câu 14-15 để đánh giá IH).",
                "target_pattern": "General trend -> Older generation habits -> Younger generation habits -> Contrast analysis",
                "steps": [
                    {"step_number": 1, "title": "Opening Contrast", "hint_vi": "Mở đầu nêu sự khác biệt rõ rệt giữa hai thế hệ.", "example_phrases": ["There is indeed a distinct generational shift in lifestyle and priorities."]},
                    {"step_number": 2, "title": "Older Generation", "hint_vi": "Thế hệ lớn tuổi chuộng ổn định, tụ họp gia đình.", "example_phrases": ["Our parents' generation valued job stability and preferred family-centered gatherings and outdoor walks."]},
                    {"step_number": 3, "title": "Younger Generation", "hint_vi": "Thế hệ trẻ chuộng trải nghiệm, làm việc linh hoạt, mạng xã hội.", "example_phrases": ["In contrast, Gen Z and millennials prioritize work-life balance, solo travel, and digital connectivity."]}
                ],
                "recommended_vocabulary": ["generational shift", "job stability", "work-life balance", "digital natives", "in sharp contrast"],
                "sample_sentence_starters": ["When comparing the two generations...", "While the older generation tended to..."]
            }
        }
    ],
    "communication_media": [
        {
            "type": "description",
            "text": "How do you primarily use communication media and social apps in your daily life? Describe the tools you use and how they affect your daily routine.",
            "guide": {
                "overview": "Miêu tả cách bạn dùng các ứng dụng nhắn tin và mạng xã hội trong nhịp sống hàng ngày.",
                "target_pattern": "Daily media ecosystem -> Morning routine -> Work communication -> Evening winding down",
                "steps": [
                    {"step_number": 1, "title": "Media Ecosystem", "hint_vi": "Các ứng dụng thiết yếu (Zalo, Slack, Instagram).", "example_phrases": ["Digital media is intertwined with almost every hour of my daily routine."]},
                    {"step_number": 2, "title": "Routine from Morning to Evening", "hint_vi": "Thói quen buổi sáng lướt tin tức, buổi làm việc nhắn tin.", "example_phrases": ["First thing in the morning, I glance at news updates and team messages on Slack."]},
                    {"step_number": 3, "title": "Impact & Reflection", "hint_vi": "Đánh giá mặt tích cực và tiêu cực (mỏi mắt, xao nhãng).", "example_phrases": ["While it boosts productivity, it can also lead to digital fatigue if not managed mindfully."]}
                ],
                "recommended_vocabulary": ["intertwined", "digital fatigue", "stay connected", "productivity booster"],
                "sample_sentence_starters": ["To be honest, I rely heavily on...", "Throughout the day, my primary tool is..."]
            }
        },
        {
            "type": "unexpected_situation",
            "text": "Think about a time when you experienced a serious communication breakdown due to a technology failure or social media misunderstanding. What happened, and how did you fix it?",
            "guide": {
                "overview": "Kể sự cố gián đoạn liên lạc hoặc hiểu lầm công nghệ (Unexpected situation - cốt lõi để đạt IH).",
                "target_pattern": "Context -> Tech breakdown / Misunderstanding -> Urgency & Stress -> How you resolved it -> Lesson learned",
                "steps": [
                    {"step_number": 1, "title": "Context", "hint_vi": "Khi đang cần gửi tài liệu hoặc liên lạc quan trọng.", "example_phrases": ["I had an unforgettable panic moment last year when our home internet completely crashed right before a client presentation."]},
                    {"step_number": 2, "title": "The Complication", "hint_vi": "Không có mạng, 4G điện thoại yếu, máy báo lỗi.", "example_phrases": ["My phone hotspot was unstable, and the client was waiting in the Zoom room."]},
                    {"step_number": 3, "title": "Prompt Action", "hint_vi": "Chạy ra quán cà phê gần nhất hoặc gọi điện trực tiếp.", "example_phrases": ["I immediately sprinted to a nearby café with high-speed Wi-Fi, dialed in via audio first, and apologized professionally."]}
                ],
                "recommended_vocabulary": ["panic moment", "unstable connection", "sprinted to", "dialed in", "backup plan"],
                "sample_sentence_starters": ["An unexpected incident occurred when...", "The real trouble started when..."]
            }
        }
    ]
}

ROLE_PLAY_QUESTIONS = [
    {
        "type": "role_play_ask",
        "topic": "Role-Play (Inquiry)",
        "text": "I'd like to give you a situation. You want to register for a new fitness center or co-working space. Call the manager and ask three or four questions to get the necessary details.",
        "guide": {
            "overview": "Đóng vai gọi điện thoại hỏi 3-4 câu hỏi chi tiết về dịch vụ (yêu cầu cốt lõi của phần Role-play OPIc).",
            "target_pattern": "Greeting & Purpose -> Question 1 (Pricing/Membership) -> Question 2 (Hours/Facilities) -> Question 3 (Promotion/Trial) -> Closing",
            "steps": [
                {"step_number": 1, "title": "Greeting & Purpose", "hint_vi": "Chào hỏi và nói rõ lý do gọi điện.", "example_phrases": ["Hello, I'm calling because I'm interested in joining your fitness club."]},
                {"step_number": 2, "title": "Question 1 & 2", "hint_vi": "Hỏi về giá gói thành viên và giờ mở cửa.", "example_phrases": ["Could you tell me about the monthly membership fees? Also, what are your operating hours on weekends?"]},
                {"step_number": 3, "title": "Question 3 & 4", "hint_vi": "Hỏi về giáo viên/thiết bị và ưu đãi học thử.", "example_phrases": ["Do you provide personal trainer consultations? And is there a free trial session available before signing up?"]},
                {"step_number": 4, "title": "Closing", "hint_vi": "Cảm ơn và hẹn đến xem trực tiếp.", "example_phrases": ["Thank you so much for the information. I'll drop by this afternoon!"]}
            ],
            "recommended_vocabulary": ["interested in joining", "membership fees", "operating hours", "free trial pass", "drop by"],
            "sample_sentence_starters": ["Hi, I'm calling to inquire about...", "I was wondering if you could let me know..."]
        }
    },
    {
        "type": "role_play_problem",
        "topic": "Role-Play (Problem & Alternative)",
        "text": "Now, an unexpected problem has occurred. You arrived at the facility, but they have no record of your reservation and all lockers/spaces are fully booked. Explain the situation to the front desk and offer two to three alternatives to resolve it.",
        "guide": {
            "overview": "Xử lý sự cố bất ngờ trong đóng vai: Giải thích vấn đề và đề xuất 2-3 giải pháp thay thế (Target IH).",
            "target_pattern": "State Identity & Issue -> Explain evidence (confirmation email) -> Alternative 1 -> Alternative 2 -> Conclusion",
            "steps": [
                {"step_number": 1, "title": "State the Situation", "hint_vi": "Nói rõ tên và tình huống bị nhầm lẫn đặt chỗ.", "example_phrases": ["Excuse me, I booked a session for 3 PM today under the name Alex, but your system shows no record."]},
                {"step_number": 2, "title": "Show Confirmation", "hint_vi": "Đưa bằng chứng email xác nhận.", "example_phrases": ["I actually have the confirmation email and receipt right here on my phone."]},
                {"step_number": 3, "title": "Offer Alternatives (Quan trọng!)", "hint_vi": "Đưa ra 2 giải pháp thay thế linh hoạt.", "example_phrases": ["Since lockers are full, could I either share a temporary locker or reschedule to the 5 PM slot with a complimentary guest pass?"]},
                {"step_number": 4, "title": "Friendly Agreement", "hint_vi": "Chốt lại giải pháp lịch sự.", "example_phrases": ["I really appreciate your help sorting this out."]}
            ],
            "recommended_vocabulary": ["no record of my booking", "confirmation receipt", "temporary locker", "reschedule", "complimentary"],
            "sample_sentence_starters": ["Excuse me, there seems to be a mix-up with...", "Would it be possible if we instead..."]
        }
    },
    {
        "type": "role_play_experience",
        "topic": "Role-Play (Related Experience)",
        "text": "That's the end of the situation. Have you ever had a similar problem with a reservation or a service you signed up for? Tell me what happened, how you dealt with it, and how it turned out.",
        "guide": {
            "overview": "Câu thứ 3 của Role-play: kể lại trải nghiệm thật có vấn đề tương tự, bắt buộc dùng thì quá khứ và có cao trào - cách giải quyết (Target IH).",
            "target_pattern": "When & Where -> What went wrong -> How you handled it -> Result & Lesson",
            "steps": [
                {"step_number": 1, "title": "Set the Scene", "hint_vi": "Thời gian, địa điểm và bạn đã đặt dịch vụ gì.", "example_phrases": ["Actually, something similar happened to me last year when I booked a hotel room in Da Nang."]},
                {"step_number": 2, "title": "The Problem", "hint_vi": "Sự cố xảy ra thế nào, cảm xúc của bạn lúc đó.", "example_phrases": ["When I arrived, the receptionist told me my booking had been cancelled by mistake, and I was really frustrated."]},
                {"step_number": 3, "title": "Resolution & Lesson", "hint_vi": "Bạn đã xử lý ra sao, kết quả và bài học rút ra.", "example_phrases": ["I stayed calm, showed my confirmation, and they upgraded me to a better room. Since then, I always double-check my bookings."]}
            ],
            "recommended_vocabulary": ["cancelled by mistake", "frustrated", "stayed calm", "upgraded", "double-check"],
            "sample_sentence_starters": ["Actually, something similar happened to me when...", "In the end, it turned out that..."]
        }
    }
]

# Generic Vietnamese guides per question type, used for AI-generated questions until their
# personalised guides are produced in the background.
DEFAULT_GUIDES_BY_TYPE = {
    "self_intro": {
        "overview": "Giới thiệu bản thân trôi chảy, tự nhiên trong 60-90 giây: tên, công việc, nơi sống, sở thích.",
        "target_pattern": "Greeting & Name -> Job/Study -> Living situation -> Hobbies -> Wrap-up",
        "steps": [
            {"step_number": 1, "title": "Greeting & Identity", "hint_vi": "Chào Eva, giới thiệu tên và công việc/ngành học.", "example_phrases": ["Hi Eva, my name is Minh, and I currently work as a marketing specialist."]},
            {"step_number": 2, "title": "Life & Interests", "hint_vi": "Nơi sống, sống với ai, sở thích lúc rảnh.", "example_phrases": ["I live in an apartment with my family, and in my free time I love going to cozy cafes."]},
            {"step_number": 3, "title": "Future Goal", "hint_vi": "Kết bằng mục tiêu tương lai (dùng thì tương lai).", "example_phrases": ["In the near future, I'm hoping to get promoted and travel abroad more often."]}
        ],
        "recommended_vocabulary": ["currently work as", "in my free time", "passionate about", "in the near future"],
        "sample_sentence_starters": ["First of all, my name is...", "When I'm not working, I usually..."]
    },
    "description": {
        "overview": "Miêu tả chi tiết (hiện tại đơn), đi từ tổng quan đến chi tiết và kết bằng cảm nhận cá nhân.",
        "target_pattern": "General impression -> Detail 1 -> Detail 2 -> Personal feeling",
        "steps": [
            {"step_number": 1, "title": "Big Picture", "hint_vi": "Nêu ấn tượng chung.", "example_phrases": ["Well, the first thing that comes to mind is how cozy and peaceful it is."]},
            {"step_number": 2, "title": "Specific Details", "hint_vi": "2-3 chi tiết cụ thể: vị trí, hình dáng, không khí, con người.", "example_phrases": ["It's located on a quiet street, and it has large windows that let in lots of natural light."]},
            {"step_number": 3, "title": "Why It Matters", "hint_vi": "Vì sao bạn thích / ý nghĩa với bạn.", "example_phrases": ["That's why it has become an essential part of my daily life."]}
        ],
        "recommended_vocabulary": ["cozy", "conveniently located", "laid-back atmosphere", "essential part of"],
        "sample_sentence_starters": ["Let me describe...", "What I like most about it is..."]
    },
    "routine": {
        "overview": "Kể thói quen theo trình tự thời gian (hiện tại đơn + trạng từ tần suất), thêm so sánh thay đổi để đạt IH.",
        "target_pattern": "Frequency -> Step-by-step routine -> How it has changed",
        "steps": [
            {"step_number": 1, "title": "How Often", "hint_vi": "Bạn làm việc đó thường xuyên thế nào.", "example_phrases": ["I usually do this at least three times a week, mostly in the evenings."]},
            {"step_number": 2, "title": "Sequence", "hint_vi": "Dùng từ nối first, then, after that, finally.", "example_phrases": ["First, I..., then I..., and after that I usually..."]},
            {"step_number": 3, "title": "Change Over Time", "hint_vi": "So sánh với trước đây (used to).", "example_phrases": ["I used to do it only on weekends, but now it's part of my daily routine."]}
        ],
        "recommended_vocabulary": ["on a regular basis", "first of all", "after that", "used to"],
        "sample_sentence_starters": ["On a typical day, I...", "These days, I tend to..."]
    },
    "past_experience": {
        "overview": "Kể chuyện quá khứ có cao trào (complication) và cách giải quyết - yếu tố then chốt để đạt IH.",
        "target_pattern": "Context -> What happened -> Complication -> Resolution -> Feeling/Lesson",
        "steps": [
            {"step_number": 1, "title": "Context", "hint_vi": "Khi nào, ở đâu, với ai (quá khứ đơn).", "example_phrases": ["I vividly remember one weekend about two years ago when I was with my best friend."]},
            {"step_number": 2, "title": "Complication", "hint_vi": "Sự cố bất ngờ xảy ra.", "example_phrases": ["Out of nowhere, things went wrong and we had no idea what to do."]},
            {"step_number": 3, "title": "Resolution & Lesson", "hint_vi": "Cách giải quyết, kết quả và bài học.", "example_phrases": ["Luckily, we managed to sort it out, and I learned to always have a backup plan."]}
        ],
        "recommended_vocabulary": ["vividly remember", "out of nowhere", "managed to", "backup plan"],
        "sample_sentence_starters": ["I remember a time when...", "The biggest problem was..."]
    },
    "comparison": {
        "overview": "So sánh quá khứ - hiện tại và dự đoán tương lai, kiểm soát cả 3 thì để đạt IH.",
        "target_pattern": "Past situation -> Present situation -> Reasons for change -> Future outlook",
        "steps": [
            {"step_number": 1, "title": "Past vs Present", "hint_vi": "Trước đây thế nào (used to), bây giờ thế nào.", "example_phrases": ["About ten years ago, people used to..., but nowadays most people..."]},
            {"step_number": 2, "title": "Reasons", "hint_vi": "Nguyên nhân của sự thay đổi.", "example_phrases": ["I think this is mainly because of technology and changing lifestyles."]},
            {"step_number": 3, "title": "Future Outlook", "hint_vi": "Dự đoán tương lai (will, be likely to).", "example_phrases": ["In the future, I believe this trend will continue to grow."]}
        ],
        "recommended_vocabulary": ["used to", "nowadays", "mainly because of", "is likely to"],
        "sample_sentence_starters": ["Compared to the past...", "Looking ahead, I think..."]
    },
    "unexpected_situation": {
        "overview": "Kể lại tình huống bất ngờ/khó khăn và cách bạn xử lý, nhấn mạnh hành động chủ động.",
        "target_pattern": "Background -> Unexpected problem -> Actions taken -> Outcome",
        "steps": [
            {"step_number": 1, "title": "Background", "hint_vi": "Bối cảnh trước khi sự cố xảy ra.", "example_phrases": ["It was supposed to be a normal day at work, but things quickly changed."]},
            {"step_number": 2, "title": "Actions", "hint_vi": "Các bước bạn đã làm để xử lý.", "example_phrases": ["I immediately contacted my manager and suggested a few alternatives."]},
            {"step_number": 3, "title": "Outcome", "hint_vi": "Kết quả và cảm nghĩ.", "example_phrases": ["In the end, everything worked out, and it taught me to stay calm under pressure."]}
        ],
        "recommended_vocabulary": ["supposed to", "immediately", "alternatives", "under pressure"],
        "sample_sentence_starters": ["Something unexpected happened when...", "To handle the situation, I..."]
    },
    "role_play_ask": ROLE_PLAY_QUESTIONS[0]["guide"],
    "role_play_problem": ROLE_PLAY_QUESTIONS[1]["guide"],
    "role_play_experience": ROLE_PLAY_QUESTIONS[2]["guide"],
}

SURVEY_QUESTIONS_MAP = {
    "living_situation": [
        {
            "type": "description",
            "text": "You indicated in the survey that you live in a house or apartment. Can you describe your home to me? What does it look like, and what is your favorite room?",
            "guide": {
                "overview": "Miêu tả ngôi nhà/căn hộ và căn phòng yêu thích nhất.",
                "target_pattern": "Overall description (location, type) -> Layout & Rooms -> Favorite Room -> Why you love it",
                "steps": [
                    {"step_number": 1, "title": "General Overview", "hint_vi": "Căn hộ/nhà ở đâu, gồm mấy phòng.", "example_phrases": ["I live in a cozy apartment located in a bustling district of the city."]},
                    {"step_number": 2, "title": "Layout", "hint_vi": "Bố cục phòng khách, bếp, ban công.", "example_phrases": ["It consists of two bedrooms, a bright living room, and an open kitchen."]},
                    {"step_number": 3, "title": "Favorite Spot", "hint_vi": "Phòng yêu thích (góc ban công/phòng ngủ) và cảm giác bình yên.", "example_phrases": ["My absolute favorite spot is my bedroom because it catches warm sunlight and lets me unwind."]}
                ],
                "recommended_vocabulary": ["cozy apartment", "bustling district", "open-plan layout", "unwind after work"],
                "sample_sentence_starters": ["I'd like to tell you about my home...", "What makes it special to me is..."]
            }
        },
        {
            "type": "routine",
            "text": "What do you usually do when you are at home on weekends? Walk me through your typical weekend routine from morning to night.",
            "guide": {
                "overview": "Trình bày thói quen cuối tuần ở nhà theo trình tự thời gian.",
                "target_pattern": "Morning Routine -> Afternoon Leisure/Chores -> Evening Relaxation",
                "steps": [
                    {"step_number": 1, "title": "Morning Routine", "hint_vi": "Thức dậy muộn hơn, pha cà phê, nấu bữa sáng.", "example_phrases": ["On weekends, I love sleeping in a bit and brewing a fresh cup of coffee."]},
                    {"step_number": 2, "title": "Afternoon Chores & Hobbies", "hint_vi": "Dọn dẹp nhà cửa hoặc đọc sách, nấu ăn.", "example_phrases": ["In the afternoon, I tend to tidy up the apartment and experiment with new cooking recipes."]},
                    {"step_number": 3, "title": "Evening Relaxation", "hint_vi": "Xem phim trên Netflix hoặc nghe nhạc thư giãn.", "example_phrases": ["By evening, I wind down by watching an episode on Netflix or reading a novel."]}
                ],
                "recommended_vocabulary": ["sleep in", "tidy up", "experiment with recipes", "wind down"],
                "sample_sentence_starters": ["My weekend routine is quite relaxing...", "As the day progresses, I usually..."]
            }
        }
    ],
    "leisure_activities": [
        {
            "type": "description",
            "text": "You mentioned that you enjoy going to cafés or parks in your free time. Describe your favorite café or park. Where is it located, and what is the atmosphere like?",
            "guide": {
                "overview": "Miêu tả quán cà phê hoặc công viên quen thuộc.",
                "target_pattern": "Name & Location -> Ambiance & Interior -> Signature drink/features -> Why it attracts you",
                "steps": [
                    {"step_number": 1, "title": "Location & Vibe", "hint_vi": "Quán ở đâu, không gian yên tĩnh hay sôi động.", "example_phrases": ["There is a quaint little coffee shop tucked away in a quiet alley near my workplace."]},
                    {"step_number": 2, "title": "Interior & Sensory Details", "hint_vi": "Ánh sáng, cây xanh, mùi hương cà phê.", "example_phrases": ["It has rustic wooden tables, lush green plants, and the soothing aroma of roasted coffee beans."]},
                    {"step_number": 3, "title": "Signature Item & Emotion", "hint_vi": "Món đồ uống đặc trưng và cảm giác khi ngồi đó.", "example_phrases": ["I always order their signature iced latte; sipping it while listening to soft jazz is pure bliss."]}
                ],
                "recommended_vocabulary": ["quaint", "tucked away", "rustic wooden tables", "soothing aroma", "pure bliss"],
                "sample_sentence_starters": ["One of my go-to spots is...", "What draws me back every time is..."]
            }
        },
        {
            "type": "past_experience",
            "text": "Tell me about a memorable or unexpected incident that happened to you while visiting a café, restaurant, or park. What happened, and how did it end?",
            "guide": {
                "overview": "Kể một sự cố đáng nhớ ở quán cà phê/công viên có tình huống bất ngờ (Complication) để ghi điểm IH.",
                "target_pattern": "Background -> The Incident (Spilled drink / Lost item / Surprise encounter) -> Immediate reaction -> How it ended",
                "steps": [
                    {"step_number": 1, "title": "Context", "hint_vi": "Thời điểm đến quán và bạn đi với ai.", "example_phrases": ["A few months ago, I was sitting at a café working on an important proposal on my laptop."]},
                    {"step_number": 2, "title": "The Complication", "hint_vi": "Sự cố: Làm đổ cốc nước hoặc để quên ví/điện thoại.", "example_phrases": ["Suddenly, a customer next to me bumped into the table, and iced tea spilled right across my keyboard!"]},
                    {"step_number": 3, "title": "Fast Recovery", "hint_vi": "Cách xử lý nhanh chóng và sự hỗ trợ của nhân viên.", "example_phrases": ["I immediately flipped the laptop over, and the barista rushed over with dry towels. Luckily, the device survived!"]}
                ],
                "recommended_vocabulary": ["important proposal", "bumped into", "spilled right across", "rushed over", "relieved"],
                "sample_sentence_starters": ["I'll never forget an incident when...", "Everything was peaceful until suddenly..."]
            }
        }
    ]
}
