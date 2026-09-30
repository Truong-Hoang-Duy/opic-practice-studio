import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from app.config import settings

def generate_session_pdf(
    session_id: int,
    user_name: str,
    overall_level: str,
    justification: str,
    radar_scores: dict,
    strengths: list,
    weaknesses: list,
    study_plan: dict
) -> str:
    """
    Generates a PDF diagnostic report using ReportLab and returns the relative URL.
    """
    filename = f"opic_report_session_{session_id}.pdf"
    filepath = os.path.join(settings.REPORTS_DIR, filename)
    relative_url = f"/data/reports/{filename}"

    doc = SimpleDocTemplate(
        filepath,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=15
    )

    h2_style = ParagraphStyle(
        'H2Style',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0284c7"),
        spaceBefore=12,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155")
    )

    disclaimer_style = ParagraphStyle(
        'Disclaimer',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#94a3b8"),
        alignment=1 # center
    )

    story = []

    # Title & Header
    story.append(Paragraph("OPIc Practice Studio - Diagnostic Report", title_style))
    story.append(Paragraph(f"Candidate: <b>{user_name}</b> | Session ID: #{session_id} | Target Benchmark: <b>Intermediate High (IH)</b>", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=15))

    # Overall Result Badge Table
    is_passed = overall_level in ["IH", "AL"]
    level_color = colors.HexColor("#10b981") if overall_level in ["IH", "AL"] else colors.HexColor("#0284c7") if overall_level == "IM" else colors.HexColor("#f59e0b")
    status_color = colors.HexColor("#10b981") if is_passed else colors.HexColor("#ef4444")
    status_text = "PASSED (ĐẬU) - Meets ACTFL IH Benchmark" if is_passed else "FAILED (CHƯA ĐẠT) - Below ACTFL IH Benchmark"

    result_data = [
        [
            Paragraph("<b>Estimated Proficiency Level:</b>", body_style),
            Paragraph(f"<font color='{level_color.hexval()}'><b>{overall_level}</b></font>", ParagraphStyle('Lvl', parent=body_style, fontSize=16, leading=18))
        ],
        [
            Paragraph("<b>Final Verdict (Kết quả):</b>", body_style),
            Paragraph(f"<font color='{status_color.hexval()}'><b>{status_text}</b></font>", ParagraphStyle('Status', parent=body_style, fontSize=12, leading=15))
        ]
    ]
    result_table = Table(result_data, colWidths=[200, 320])
    result_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(result_table)
    story.append(Spacer(1, 10))

    # Justification
    story.append(Paragraph("Examiner Justification", h2_style))
    story.append(Paragraph(justification, body_style))
    story.append(Spacer(1, 10))

    # Core Criteria Breakdown Table
    story.append(Paragraph("6 Core ACTFL Criteria Assessment", h2_style))
    criteria_names = {
        "fluency_and_length": "Fluency & Discourse Length (60-120s)",
        "tense_control": "Tense Control (Past / Present / Future)",
        "organization": "Paragraph Organization & Connectors",
        "vocabulary": "Vocabulary Variety & Idiomatic Phrasing",
        "grammar": "Grammar Accuracy & Sentence Complexity",
        "task_completion": "Task Completion & Role-play Handling"
    }

    sub_data = [["Criterion", "Score (1-5)", "Status"]]
    for key, name in criteria_names.items():
        score = radar_scores.get(key, 3.0)
        status = "Mastered (IH)" if score >= 4.0 else "Developing (IM)" if score >= 3.0 else "Needs Work (IL)"
        sub_data.append([name, f"{score:.1f} / 5.0", status])

    sub_table = Table(sub_data, colWidths=[270, 110, 140])
    sub_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0284c7")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(sub_table)
    story.append(Spacer(1, 10))

    # Strengths & Weaknesses
    story.append(Paragraph("Key Observations", h2_style))
    str_text = "<b>Strengths:</b><br/>" + "<br/>".join([f"• {s}" for s in strengths[:4]])
    weak_text = "<b>Areas for Growth:</b><br/>" + "<br/>".join([f"• {w}" for w in weaknesses[:4]])
    story.append(Paragraph(str_text, body_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph(weak_text, body_style))
    story.append(Spacer(1, 10))

    # Study Plan
    if study_plan and "weekly_focus" in study_plan:
        story.append(Paragraph("Personalized 4-Week Road to Intermediate High (IH)", h2_style))
        plan_data = [["Week", "Core Theme & Target Outcome"]]
        for item in study_plan.get("weekly_focus", []):
            week_num = f"Week {item.get('week', 1)}"
            theme = f"<b>{item.get('theme', '')}</b><br/>Target: {item.get('target_outcome', '')}"
            plan_data.append([week_num, Paragraph(theme, body_style)])

        plan_table = Table(plan_data, colWidths=[80, 440])
        plan_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#334155")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
            ('PADDING', (0,0), (-1,-1), 5),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        story.append(plan_table)

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=8))
    story.append(Paragraph(
        "Disclaimer: OPIc Practice Studio is an independent educational practice platform and is not affiliated with, sponsored by, or endorsed by ACTFL or Language Testing International (LTI).",
        disclaimer_style
    ))

    doc.build(story)
    return relative_url
