"""
OPIc Practice Studio - Standard Proficiency Rubrics
Used across evaluation prompts, model answers generation, and feedback coaching.
"""

from typing import Dict, Any

LEVEL_DESCRIPTORS = {
    "below_IL": {
        "title": "Below Intermediate Low (Novice High / Novice Mid)",
        "summary": "Answer is fragmented, relying on isolated words and memorized phrases. Unable to sustain complete sentence discourse.",
        "vietnamese_summary": "Câu trả lời rời rạc, chỉ dùng từ đơn lẻ hoặc cụm từ học vẹt, chưa nói được thành câu hoàn chỉnh.",
        "fluency": "Long pauses, hesitation, very few connected words.",
        "grammar_tenses": "Almost no tense consistency; isolated present tense stems.",
        "discourse": "Isolated words or incomplete phrases.",
    },
    "IL": {
        "title": "Intermediate Low (IL)",
        "summary": "Mostly short sentences, present tense, simple descriptions, frequent pauses.",
        "vietnamese_summary": "Chủ yếu các câu đơn ngắn, thì hiện tại đơn, miêu tả đơn giản, ngập ngừng nhiều.",
        "fluency": "Frequent pauses, speech is halting but understandable in simple contexts.",
        "grammar_tenses": "Mainly present tense; struggles with past or future tenses.",
        "discourse": "Discrete short sentences; lacks paragraph flow and cohesive transition words.",
    },
    "IM": {
        "title": "Intermediate Mid (IM)",
        "summary": "Connected sentences, some past/future attempts, basic paragraph, can handle simple unexpected situations with effort.",
        "vietnamese_summary": "Các câu đã có liên kết, bắt đầu dùng thì quá khứ/tương lai, tạo đoạn văn cơ bản, xử lý tình huống bất ngờ với chút khó khăn.",
        "fluency": "More sustained speech; pauses occur when searching for vocabulary or complex structures.",
        "grammar_tenses": "Consistent present tense; emerging past tense (may have irregular verb errors); attempts future.",
        "discourse": "Basic paragraph length; uses simple connectors (and, but, because, so, then).",
    },
    "IH": {
        "title": "Intermediate High (IH) - TARGET LEVEL",
        "summary": "Paragraph-length discourse, consistent control of past/present/future, story with a complication, handles unexpected situations with clear explanation, mostly fluent.",
        "vietnamese_summary": "Đoạn văn dài và mạch lạc, kiểm soát tốt các thì (quá khứ, hiện tại, tương lai), kể câu chuyện có tình huống bất ngờ/khó khăn, xử lý tình huống linh hoạt, trôi chảy.",
        "fluency": "Speech flows naturally with minimal hesitation; comfortable speaking for 60-120 seconds.",
        "grammar_tenses": "Solid command of all 3 tenses (past, present, future) with minimal breakdown.",
        "discourse": "Extended paragraph structure with clear transitions, rich descriptions, and clear narrative progression (Opening -> Context -> Complication/Detail -> Resolution -> Conclusion).",
    }
}

SUB_SCORE_CRITERIA = {
    "fluency_and_length": {
        "name": "Fluency & Length (Độ trôi chảy & Độ dài)",
        "description": "Continuous speech flow, natural pacing, target speaking duration between 60 to 120 seconds with minimal unnatural silence.",
        "scale": {
            1: "Very short (<25s), disjointed speech with long awkward pauses.",
            2: "Short (<45s), noticeable hesitation, halting rhythm.",
            3: "Moderate length (45-65s), steady with occasional pauses.",
            4: "Good length (70-95s), mostly continuous and natural pace.",
            5: "Excellent duration (90-120s), highly natural rhythm and speech momentum."
        }
    },
    "tense_control": {
        "name": "Tense Control (Kiểm soát các thì)",
        "description": "Accurate and purposeful use of past, present, and future tenses, especially past narrative consistency.",
        "scale": {
            1: "Only basic present tense or uninflected verb forms.",
            2: "Present tense dominant, attempted past with frequent breakdown.",
            3: "Consistent present tense, basic past tense used with occasional irregular errors.",
            4: "Solid past tense narration alongside present and future; minor slips under pressure.",
            5: "Masterful switching between past, present, and future with precision."
        }
    },
    "organization": {
        "name": "Organization & Discourse (Bố cục & Tính mạch lạc)",
        "description": "Clear paragraph structure (Opening, Details, Complication/Highlight, Conclusion) and linking words.",
        "scale": {
            1: "List of disconnected ideas without transitions.",
            2: "Basic sequence (first, next) but feels like a list of separate sentences.",
            3: "Connected sentences with basic transitional words (and, but, because, so).",
            4: "Well-structured paragraph with clear beginning, body, and conclusion.",
            5: "Sophisticated discourse with nuance, seamless transitions, and narrative complication."
        }
    },
    "vocabulary": {
        "name": "Vocabulary Richness (Vốn từ vựng)",
        "description": "Topic-specific vocabulary, idiomatic collocations, avoiding repetitive generic words (good, nice, like).",
        "scale": {
            1: "Extremely limited vocabulary, repetitive basic words.",
            2: "Sufficient for simple survival phrases, lacks descriptive variety.",
            3: "Good everyday vocabulary, some topic-specific terminology.",
            4: "Rich adjectives, phrasal verbs, and expressive collocations.",
            5: "Vivid, precise, and idiomatic expressions suited to the topic."
        }
    },
    "grammar": {
        "name": "Grammar Accuracy (Độ chính xác ngữ pháp)",
        "description": "Subject-verb agreement, plural forms, prepositions, and sentence variety (compound and complex sentences).",
        "scale": {
            1: "Frequent grammatical breakdowns that impede understanding.",
            2: "Understandable despite noticeable errors in word order and verb forms.",
            3: "Generally correct simple sentences; errors appear in complex structures.",
            4: "Mostly error-free with good use of relative clauses and connectors.",
            5: "High syntactic complexity with rare, non-distracting errors."
        }
    },
    "task_completion": {
        "name": "Task Completion (Hoàn thành yêu cầu đề bài)",
        "description": "Addresses all prompt prompts/questions thoroughly, including role-play inquiries or problem-solving requirements.",
        "scale": {
            1: "Off-topic or fails to answer the core prompt question.",
            2: "Touches upon the prompt but answers only a minor sub-part.",
            3: "Addresses the main question with adequate basic information.",
            4: "Thoroughly answers all sub-questions with illustrative examples.",
            5: "Exceeds expectations with deep personal reflection, vivid stories, and proactive problem resolution."
        }
    }
}

TOPIC_OPTIONS = [
    {"id": "environment", "title": "Environment", "vietnamese": "Môi trường", "description": "Climate change, recycling, pollution, and eco-friendly lifestyle."},
    {"id": "human_rights", "title": "Human Rights", "vietnamese": "Quyền con người", "description": "Equality, workplace rights, freedom of expression, and fair treatment."},
    {"id": "global_workplace", "title": "Global Workplace", "vietnamese": "Môi trường làm việc toàn cầu", "description": "Remote work, multicultural collaboration, career growth, and corporate culture."},
    {"id": "socio_cultural", "title": "Socio-Cultural Issues", "vietnamese": "Vấn đề Văn hóa - Xã hội", "description": "Generational differences, traditions vs modern lifestyle, social trends."},
    {"id": "communication_media", "title": "Communication Media", "vietnamese": "Phương tiện truyền thông", "description": "Social media impact, instant messaging, fake news, and digital communication."}
]

SELF_ASSESSMENT_LEVELS = [
    {
        "level": 1,
        "label": "Level 1: Novice Low-Mid",
        "en": "I can only say individual words and memorized phrases like greetings.",
        "vi": "Tôi chỉ có thể nói các từ đơn lẻ và cụm từ quen thuộc học vẹt như lời chào hỏi.",
        "target": "IL"
    },
    {
        "level": 2,
        "label": "Level 2: Novice High",
        "en": "I can make simple sentences in the present tense about basic personal facts.",
        "vi": "Tôi có thể nói các câu đơn giản thì hiện tại về thông tin cá nhân cơ bản.",
        "target": "IL"
    },
    {
        "level": 3,
        "label": "Level 3: Intermediate Low",
        "en": "I can ask and answer simple questions, but I struggle to speak in connected sentences.",
        "vi": "Tôi có thể hỏi và trả lời các câu hỏi đơn giản, nhưng gặp khó khăn khi nói câu ghép liên tục.",
        "target": "IM"
    },
    {
        "level": 4,
        "label": "Level 4: Intermediate Mid",
        "en": "I can speak in full sentences and describe my routine and past events with some errors.",
        "vi": "Tôi có thể nói thành câu hoàn chỉnh, miêu tả thói quen và sự kiện quá khứ (vẫn có vài lỗi sai).",
        "target": "IH"
    },
    {
        "level": 5,
        "label": "Level 5: Intermediate High",
        "en": "I can speak comfortably in paragraphs, narrate stories across past, present, and future, and handle unexpected situations.",
        "vi": "Tôi nói tự tin thành từng đoạn văn, kể chuyện mượt mà ở các thì, và xử lý được tình huống bất ngờ.",
        "target": "IH"
    },
    {
        "level": 6,
        "label": "Level 6: Advanced",
        "en": "I can speak fluently and in detail about complex abstract, social, and professional topics.",
        "vi": "Tôi có thể nói lưu loát, chi tiết về các chủ đề trừu tượng, xã hội và chuyên môn phức tạp.",
        "target": "IH"
    }
]

def get_rubric_prompt_text() -> str:
    """Format rubrics as clear instructional text for LLM injection."""
    text = "=== ACTFL / OPIC OFFICIAL PROFICIENCY SCALE ===\n"
    for lvl, desc in LEVEL_DESCRIPTORS.items():
        text += f"- [{lvl.upper()}]: {desc['summary']}\n"
    text += "\n=== 6 CORE EVALUATION CRITERIA (Score 1 to 5) ===\n"
    for key, crit in SUB_SCORE_CRITERIA.items():
        text += f"• {crit['name']}: {crit['description']}\n"
    return text
