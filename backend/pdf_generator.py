"""
PDF Report Generator for Simulator Poste
Generates professional multi-page strategic reports with branding
"""

import io
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Wedge, Circle
import matplotlib.patches as mpatches

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage, PageBreak, KeepTogether, Flowable
)
from reportlab.pdfgen import canvas

# Translations
translations = {
    "strategic_report": "Report Strategico",
    "confidential_document": "Documento riservato - Lutech S.p.A.",
    "page": "Pag.",
    "your_score": "Il Tuo Score:",
    "estimated_competitor": "Competitor Stimato:",
    "mean": "Media:",
    "win_zone": "Zona Vittoria",
    "risk_zone": "Zona Rischio",
    "loss_zone": "Zona Perdita",
    "total_score": "Punteggio Totale",
    "frequency": "Frequenza",
    "monte_carlo_distribution": "Distribuzione Monte Carlo",
    "simulations": "simulazioni",
    "weighted_score": "Punteggio Pesato",
    "contribution_by_category": "Contributo per Categoria",
    "points_short": "pt",
    "discount_offered_percent": "Sconto Offerto (%)",
    "win_probability_percent": "Probabilità Vittoria (%)",
    "current_discount": "Sconto Attuale:",
    "win_probability": "Probabilità Vittoria",
    "discount_scenario_analysis": "Analisi Scenari di Sconto",
    "lutech_logo_alt": "LUTECH",
    "poste_logo_alt": "POSTE",
    "strategic_report_title": "REPORT STRATEGICO",
    "tender_evaluation": "Valutazione Gara d'Appalto",
    "auction_base": "Base d'Asta",
    "generated_on": "Generato il",
    "executive_summary": "Sintesi Esecutiva",
    "win_probability_label": "Probabilità di Vittoria:",
    "discount_offered": "Sconto Offerto",
    "favorable": "favorevole",
    "favorable_recommendation": "Si consiglia di procedere con l'offerta mantenendo lo sconto proposto.",
    "balanced": "equilibrata",
    "balanced_recommendation": "Valutare un incremento dello sconto per aumentare la competitività.",
    "challenging": "sfidante",
    "challenging_recommendation": "Considerare un significativo aumento dello sconto o il miglioramento del profilo tecnico.",
    "simulation_for_lot": "La simulazione per il lotto",
    "shows_a_situation": "evidenzia una situazione",
    "with_a_total_score_of": "Con un punteggio totale di",
    "points_technical": "punti (tecnico:",
    "economic": "economico:",
    "and_a_discount_of": ") e uno sconto del",
    "the_estimated_win_probability_is": ", la probabilità stimata di vittoria è del",
    "percent_compared_to_a_competitor": "% rispetto a un competitor con sconto medio del",
    "recommendation": "Raccomandazione:",
    "technical_score": "Punteggio Tecnico",
    "economic_score": "Punteggio Economico",
    "technical_score_analysis": "Analisi Punteggio Tecnico",
    "company_certifications": "Certificazioni Aziendali",
    "professional_certifications": "Certificazioni Professionali",
    "references": "Referenze",
    "technical_projects": "Progetti Tecnici",
    "category": "Categoria",
    "score": "Punteggio",
    "contribution_percent": "Contributo %",
    "total_technical": "TOTALE TECNICO",
    "areas_for_improvement": "Aree di Miglioramento",
    "increase_company_certifications": "• Incrementare le certificazioni aziendali per migliorare il profilo qualitativo",
    "enhance_professional_certifications": "• Valorizzare maggiormente le certificazioni professionali del team",
    "add_relevant_references": "• Aggiungere referenze rilevanti per dimostrare esperienza nel settore",
    "highlight_successful_projects": "• Evidenziare progetti tecnici completati con successo",
    "solid_technical_profile": "• Profilo tecnico solido - mantenere gli attuali punti di forza",
    "economic_and_competitive_analysis": "Analisi Economica e Competitiva",
    "the_economic_offer_includes_a_discount_of": "L'offerta economica prevede uno sconto del",
    "on_an_auction_base_of": "sulla base d'asta di",
    "generating_an_economic_score_of": ", generando un punteggio economico di",
    "points_out_of_a_maximum_of": "punti su un massimo di",
    "simulation_statistics": "Statistiche Simulazione",
    "metric": "Metrica",
    "value": "Valore",
    "iterations": "Iterazioni",
    "mean_score": "Score Medio",
    "minimum_score": "Score Minimo",
    "maximum_score": "Score Massimo",
    "standard_deviation": "Deviazione Standard",
    "percentile_25": "Percentile 25°",
    "percentile_75": "Percentile 75°",
    "strategic_recommendations": "Raccomandazioni Strategiche",
    "suggested_optimal_discount": "Sconto Ottimale Suggerito:",
    "compared_to_the_current_discount_of": "Rispetto allo sconto attuale del",
    "an_increase_of": ", si suggerisce un aumento di",
    "a_decrease_of": ", si suggerisce un decremento di",
    "percentage_points_to_maximize": "punti percentuali per massimizzare la probabilità di vittoria mantenendo un equilibrio economico.",
    "current_discount_is_optimal": "Sconto Attuale Ottimale",
    "the_current_discount_of": "Lo sconto attuale del",
    "is_in_line_with_the_suggested_optimization": "è in linea con l'ottimizzazione suggerita. Non sono necessarie modifiche significative.",
    "discount_evaluation": "Valutazione Sconto:",
    "consider_the_impact_of_discount_variations": "Considerare l'impatto di variazioni dello sconto sulla probabilità di vittoria in base al contesto competitivo.",
    "simplified_swot_analysis": "Analisi SWOT Semplificata",
    "strengths": "PUNTI DI FORZA",
    "areas_of_attention": "AREE DI ATTENZIONE",
    "solid_technical_profile_strength": "Solido profilo tecnico",
    "improvable_technical_profile_weakness": "Profilo tecnico migliorabile",
    "competitive_economic_offer_strength": "Offerta economica competitiva",
    "limited_economic_margin_weakness": "Margine economico limitato",
    "high_probability_of_success_strength": "Alta probabilità di successo",
    "limited_win_probability_weakness": "Probabilità di vittoria contenuta",
    "relevant_company_certifications_strength": "Certificazioni aziendali rilevanti",
    "consolidated_references_strength": "Referenze consolidate",
    "references_to_be_strengthened_weakness": "Referenze da potenziare",
    "strategic_participation_strength": "Partecipazione strategica",
    "monitor_competitive_evolution_weakness": "Monitorare l'evoluzione competitiva",
    "next_steps": "Prossimi Passi",
    "validate_technical_data": "1. Validare i dati tecnici inseriti con il team di prevendita",
    "verify_documentation_completeness": "2. Verificare la completezza della documentazione richiesta",
    "confirm_final_discount": "3. Confermare lo sconto finale con la direzione commerciale",
    "prepare_tender_documentation": "4. Preparare la documentazione di gara entro i termini previsti",
    "evaluate_options_to_improve_technical_score": "2b. Valutare opzioni per migliorare il punteggio tecnico"
}


# Brand Colors
COLORS = {
    'primary': colors.HexColor('#003366'),      # Lutech Blue
    'secondary': colors.HexColor('#FFCC00'),    # Poste Yellow
    'success': colors.HexColor('#28a745'),      # Green
    'warning': colors.HexColor('#ffc107'),      # Yellow/Orange
    'danger': colors.HexColor('#dc3545'),       # Red
    'light': colors.HexColor('#f8f9fa'),        # Light gray
    'dark': colors.HexColor('#333333'),         # Dark text
    'muted': colors.HexColor('#6c757d'),        # Muted text
    'white': colors.white,
    'black': colors.black,
}

# Asset paths
ASSETS_DIR = os.path.join(os.path.dirname(__file__), 'assets')
LOGO_LUTECH = os.path.join(ASSETS_DIR, 'logo-lutech.png')
LOGO_POSTE = os.path.join(ASSETS_DIR, 'logo-poste.png')


class NumberedCanvas(canvas.Canvas):
    """Canvas that adds page numbers and header/footer to each page"""

    def __init__(self, *args, **kwargs):
        self.lot_name = kwargs.pop('lot_name', 'Report')
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_header_footer(self, page_count):
        page_num = self._pageNumber
        width, height = A4

        # Skip header/footer on cover page (page 1)
        if page_num == 1:
            return

        # Header line
        self.setStrokeColor(COLORS['primary'])
        self.setLineWidth(0.5)
        self.line(2*cm, height - 1.5*cm, width - 2*cm, height - 1.5*cm)

        # Header text
        self.setFont('Helvetica', 8)
        self.setFillColor(COLORS['muted'])
        self.drawString(2*cm, height - 1.3*cm, f"{translations['strategic_report']} - {self.lot_name}")
        self.drawRightString(width - 2*cm, height - 1.3*cm,
                            datetime.now().strftime("%d/%m/%Y"))

        # Footer line
        self.line(2*cm, 1.5*cm, width - 2*cm, 1.5*cm)

        # Footer text
        self.drawString(2*cm, 1*cm, translations['confidential_document'])
        self.drawRightString(width - 2*cm, 1*cm, f"{translations['page']} {page_num}/{page_count}")


class KPIBox(Flowable):
    """Custom flowable for KPI display boxes"""

    def __init__(self, label: str, value: str, color: colors.Color,
                 width: float = 5*cm, height: float = 2.5*cm):
        Flowable.__init__(self)
        self.label = label
        self.value = value
        self.color = color
        self.box_width = width
        self.box_height = height

    def draw(self):
        # Box background
        self.canv.setFillColor(COLORS['light'])
        self.canv.roundRect(0, 0, self.box_width, self.box_height, 5, fill=1, stroke=0)

        # Left color bar
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 0, 5, self.box_height, fill=1, stroke=0)

        # Value (large)
        self.canv.setFillColor(COLORS['dark'])
        self.canv.setFont('Helvetica-Bold', 20)
        self.canv.drawString(15, self.box_height - 25, self.value)

        # Label (small)
        self.canv.setFillColor(COLORS['muted'])
        self.canv.setFont('Helvetica', 9)
        self.canv.drawString(15, 10, self.label)

    def wrap(self, availWidth, availHeight):
        return (self.box_width, self.box_height)


def get_probability_color(probability: float) -> colors.Color:
    """Get color based on win probability"""
    if probability >= 60:
        return COLORS['success']
    elif probability >= 40:
        return COLORS['warning']
    else:
        return COLORS['danger']


def get_probability_label(probability: float) -> str:
    """Get label based on win probability"""
    if probability >= 60:
        return "ALTA"
    elif probability >= 40:
        return "MEDIA"
    else:
        return "BASSA"


def create_gauge_chart(value: float, max_value: float, title: str) -> io.BytesIO:
    """Create a semicircular gauge chart"""
    fig, ax = plt.subplots(figsize=(3, 2), subplot_kw={'aspect': 'equal'})

    # Calculate percentage
    pct = min(100, max(0, (value / max_value) * 100))

    # Draw background arc (gray)
    bg_wedge = Wedge(center=(0, 0), r=1, theta1=0, theta2=180,
                     facecolor='#e9ecef', edgecolor='none')
    ax.add_patch(bg_wedge)

    # Determine color based on percentage
    if pct >= 70:
        color = '#28a745'
    elif pct >= 40:
        color = '#ffc107'
    else:
        color = '#dc3545'

    # Draw value arc
    angle = 180 * (pct / 100)
    value_wedge = Wedge(center=(0, 0), r=1, theta1=0, theta2=angle,
                        facecolor=color, edgecolor='none')
    ax.add_patch(value_wedge)

    # Inner circle (white center)
    inner_circle = Circle((0, 0), 0.6, facecolor='white', edgecolor='none')
    ax.add_patch(inner_circle)

    # Value text
    ax.text(0, 0.1, f'{value:.1f}', ha='center', va='center',
            fontsize=14, fontweight='bold', color='#333333')
    ax.text(0, -0.2, f'/ {max_value:.0f}', ha='center', va='center',
            fontsize=8, color='#6c757d')

    ax.set_xlim(-1.2, 1.2)
    ax.set_ylim(-0.3, 1.2)
    ax.axis('off')
    ax.set_title(title, fontsize=10, pad=5)

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    buf.seek(0)
    return buf


def create_monte_carlo_chart(score_distribution: np.ndarray,
                             my_score: float,
                             competitor_score: float,
                             iterations: int) -> io.BytesIO:
    """Create improved Monte Carlo distribution chart with zones"""
    fig, ax = plt.subplots(figsize=(8, 4))

    # Calculate statistics
    mean_score = np.mean(score_distribution)
    std_score = np.std(score_distribution)

    # Create histogram
    n, bins, patches = ax.hist(score_distribution, bins=25,
                                color='#6c757d', alpha=0.3, edgecolor='white')

    # Color bins based on win/loss zones
    for i, patch in enumerate(patches):
        bin_center = (bins[i] + bins[i+1]) / 2
        if bin_center >= competitor_score:
            patch.set_facecolor('#28a74580')  # Green with alpha
        elif bin_center >= competitor_score - 5:
            patch.set_facecolor('#ffc10780')  # Yellow with alpha
        else:
            patch.set_facecolor('#dc354580')  # Red with alpha

    # My score line
    ax.axvline(my_score, color='#003366', linestyle='-', linewidth=3,
               label=f"{translations['your_score']} {my_score:.1f}")

    # Competitor score line (estimated)
    ax.axvline(competitor_score, color='#dc3545', linestyle='--', linewidth=2,
               label=f"{translations['estimated_competitor']} {competitor_score:.1f}")

    # Mean line
    ax.axvline(mean_score, color='#6c757d', linestyle=':', linewidth=1.5,
               label=f"{translations['mean']} {mean_score:.1f}")

    # Fill zones legend
    win_patch = mpatches.Patch(color='#28a74580', label=translations['win_zone'])
    risk_patch = mpatches.Patch(color='#ffc10780', label=translations['risk_zone'])
    loss_patch = mpatches.Patch(color='#dc354580', label=translations['loss_zone'])

    ax.set_xlabel(translations['total_score'], fontsize=11)
    ax.set_ylabel(translations['frequency'], fontsize=11)
    ax.set_title(f"{translations['monte_carlo_distribution']} ({iterations} {translations['simulations']})",
                 fontsize=12, fontweight='bold')

    # Legend
    handles, labels = ax.get_legend_handles_labels()
    handles.extend([win_patch, risk_patch, loss_patch])
    ax.legend(handles=handles, loc='upper left', fontsize=8)

    ax.grid(alpha=0.3, linestyle='--')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    buf.seek(0)
    return buf


def create_category_breakdown_chart(categories: Dict[str, float],
                                    max_tech_score: float) -> io.BytesIO:
    """Create horizontal bar chart for category breakdown"""
    fig, ax = plt.subplots(figsize=(7, 3))

    labels = list(categories.keys())
    values = list(categories.values())

    # Estimate max per category (rough distribution)
    total_value = sum(values)

    # Colors based on contribution
    bar_colors = ['#003366' if v > 0 else '#e9ecef' for v in values]

    y_pos = np.arange(len(labels))
    bars = ax.barh(y_pos, values, color=bar_colors, height=0.6, edgecolor='white')

    # Add value labels
    for i, (bar, val) in enumerate(zip(bars, values)):
        width = bar.get_width()
        ax.text(width + 0.5, bar.get_y() + bar.get_height()/2,
                f"{val:.1f} {translations['points_short']}", va='center', fontsize=9, color='#333333')

    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=10)
    ax.set_xlabel(translations['weighted_score'], fontsize=10)
    ax.set_title(translations['contribution_by_category'], fontsize=11, fontweight='bold')

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.grid(axis='x', alpha=0.3, linestyle='--')

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    buf.seek(0)
    return buf


def create_scenarios_chart(scenarios: List[Dict], my_discount: float) -> io.BytesIO:
    """Create chart showing discount scenarios and probabilities"""
    fig, ax1 = plt.subplots(figsize=(7, 3.5))

    discounts = [s['discount'] for s in scenarios]
    probabilities = [s['probability'] for s in scenarios]
    scores = [s['total_score'] for s in scenarios]

    # Primary axis: Probability
    color1 = '#003366'
    ax1.set_xlabel(translations['discount_offered_percent'], fontsize=10)
    ax1.set_ylabel(translations['win_probability_percent'], color=color1, fontsize=10)
    line1, = ax1.plot(discounts, probabilities, color=color1, linewidth=2,
                      marker='o', markersize=4, label=translations['win_probability'])
    ax1.tick_params(axis='y', labelcolor=color1)
    ax1.set_ylim(0, 100)

    # Fill area under probability curve
    ax1.fill_between(discounts, probabilities, alpha=0.1, color=color1)

    # Secondary axis: Total Score
    ax2 = ax1.twinx()
    color2 = '#28a745'
    ax2.set_ylabel(translations['total_score'], color=color2, fontsize=10)
    line2, = ax2.plot(discounts, scores, color=color2, linewidth=2,
                      linestyle='--', marker='s', markersize=4, label=translations['total_score'])
    ax2.tick_params(axis='y', labelcolor=color2)

    # Current discount line
    ax1.axvline(my_discount, color='#dc3545', linestyle=':', linewidth=2,
                label=f"{translations['current_discount']} {my_discount}%")

    # Legend
    lines = [line1, line2]
    labels = [translations['win_probability'], translations['total_score']]
    ax1.legend(lines, labels, loc='upper left', fontsize=8)

    ax1.set_title(translations['discount_scenario_analysis'], fontsize=11, fontweight='bold')
    ax1.grid(alpha=0.3, linestyle='--')
    ax1.spines['top'].set_visible(False)

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    buf.seek(0)
    return buf


def generate_pdf_report(
    lot_key: str,
    base_amount: float,
    technical_score: float,
    economic_score: float,
    total_score: float,
    my_discount: float,
    competitor_discount: float,
    category_scores: Dict[str, float],
    max_tech_score: float,
    max_econ_score: float,
    score_distribution: np.ndarray,
    win_probability: float,
    optimal_discount: Optional[float] = None,
    scenarios: Optional[List[Dict]] = None,
    iterations: int = 500
) -> io.BytesIO:
    """
    Generate comprehensive PDF report

    Returns:
        BytesIO buffer containing the PDF
    """
    buffer = io.BytesIO()

    # Create document with custom canvas for headers/footers
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2*cm,
        rightMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        name='CoverTitle',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=COLORS['primary'],
        alignment=TA_CENTER,
        spaceAfter=20
    ))

    styles.add(ParagraphStyle(
        name='CoverSubtitle',
        parent=styles['Heading2'],
        fontSize=18,
        textColor=COLORS['dark'],
        alignment=TA_CENTER,
        spaceAfter=30
    ))

    styles.add(ParagraphStyle(
        name='SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=COLORS['primary'],
        spaceBefore=20,
        spaceAfter=10,
        borderWidth=0,
        borderColor=COLORS['primary'],
        borderPadding=5
    ))

    styles.add(ParagraphStyle(
        name='BodyTextJustify',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_JUSTIFY,
        spaceAfter=10,
        leading=14
    ))

    styles.add(ParagraphStyle(
        name='VerdictHigh',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=COLORS['success'],
        alignment=TA_CENTER,
        spaceBefore=10,
        spaceAfter=10
    ))

    styles.add(ParagraphStyle(
        name='VerdictMedium',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=COLORS['warning'],
        alignment=TA_CENTER,
        spaceBefore=10,
        spaceAfter=10
    ))

    styles.add(ParagraphStyle(
        name='VerdictLow',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=COLORS['danger'],
        alignment=TA_CENTER,
        spaceBefore=10,
        spaceAfter=10
    ))

    story = []

    # =========================================================================
    # PAGE 1: COVER PAGE
    # =========================================================================

    # Logos
    logo_table_data = [[]]
    if os.path.exists(LOGO_LUTECH):
        logo_table_data[0].append(RLImage(LOGO_LUTECH, width=4*cm, height=2*cm))
    else:
        logo_table_data[0].append(Paragraph(translations['lutech_logo_alt'], styles['Heading2']))

    logo_table_data[0].append(Spacer(1, 1))

    if os.path.exists(LOGO_POSTE):
        logo_table_data[0].append(RLImage(LOGO_POSTE, width=4*cm, height=2*cm))
    else:
        logo_table_data[0].append(Paragraph(translations['poste_logo_alt'], styles['Heading2']))

    logo_table = Table(logo_table_data, colWidths=[6*cm, 5*cm, 6*cm])
    logo_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(logo_table)
    story.append(Spacer(1, 3*cm))

    # Title
    story.append(Paragraph(translations['strategic_report_title'], styles['CoverTitle']))
    story.append(Paragraph(translations['tender_evaluation'], styles['CoverSubtitle']))
    story.append(Spacer(1, 1*cm))

    # Lot name in a box
    lot_box_data = [[Paragraph(f"<b>{lot_key}</b>",
                               ParagraphStyle('LotBox', fontSize=20,
                                            textColor=COLORS['white'],
                                            alignment=TA_CENTER))]]
    lot_box = Table(lot_box_data, colWidths=[12*cm])
    lot_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLORS['primary']),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 20),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
    ]))
    story.append(lot_box)
    story.append(Spacer(1, 2*cm))

    # Quick summary stats
    summary_data = [
        [translations['auction_base'], f'€ {base_amount:,.2f}'.replace(',', '.')],
        [translations['total_score'], f'{total_score:.2f} / 100'],
        [translations['win_probability'], f'{win_probability:.1f}%'],
    ]
    summary_table = Table(summary_data, colWidths=[8*cm, 6*cm])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('TEXTCOLOR', (0, 0), (-1, -1), COLORS['dark']),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 3*cm))

    # Generation date
    date_str = datetime.now().strftime("%d %B %Y - %H:%M")
    story.append(Paragraph(f"<i>{translations['generated_on']} {date_str}</i>",
                          ParagraphStyle('DateStyle', fontSize=10,
                                        textColor=COLORS['muted'],
                                        alignment=TA_CENTER)))

    # Footer
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph(translations['confidential_document'],
                          ParagraphStyle('FooterStyle', fontSize=9,
                                        textColor=COLORS['muted'],
                                        alignment=TA_CENTER)))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: EXECUTIVE SUMMARY
    # =========================================================================

    story.append(Paragraph(translations['executive_summary'], styles['SectionTitle']))
    story.append(Spacer(1, 0.5*cm))

    # Verdict box
    prob_label = get_probability_label(win_probability)
    prob_color = get_probability_color(win_probability)

    if win_probability >= 60:
        verdict_style = 'VerdictHigh'
    elif win_probability >= 40:
        verdict_style = 'VerdictMedium'
    else:
        verdict_style = 'VerdictLow'

    verdict_data = [[
        Paragraph(f"{translations['win_probability_label']} <b>{prob_label}</b>",
                 styles[verdict_style])
    ]]
    verdict_table = Table(verdict_data, colWidths=[17*cm])
    verdict_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLORS['light']),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('BOX', (0, 0), (-1, -1), 2, prob_color),
    ]))
    story.append(verdict_table)
    story.append(Spacer(1, 0.8*cm))

    # KPI Summary Table
    kpi_data = [[
        Paragraph(f"<b>{total_score:.1f}</b><br/><font size='9' color='gray'>{translations['total_score']}</font>",
                 ParagraphStyle('KPI', fontSize=18, alignment=TA_CENTER)),
        Paragraph(f"<b>{win_probability:.0f}%</b><br/><font size='9' color='gray'>{translations['win_probability']}</font>",
                 ParagraphStyle('KPI', fontSize=18, alignment=TA_CENTER, textColor=prob_color)),
        Paragraph(f"<b>{my_discount:.1f}%</b><br/><font size='9' color='gray'>{translations['discount_offered']}</font>",
                 ParagraphStyle('KPI', fontSize=18, alignment=TA_CENTER)),
    ]]
    kpi_table = Table(kpi_data, colWidths=[5.5*cm, 5.5*cm, 5.5*cm])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLORS['light']),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('BOX', (0, 0), (0, 0), 1, COLORS['primary']),
        ('BOX', (1, 0), (1, 0), 1, prob_color),
        ('BOX', (2, 0), (2, 0), 1, COLORS['secondary']),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 0.8*cm))

    # Summary text
    if win_probability >= 60:
        situation = translations['favorable']
        recommendation = translations['favorable_recommendation']
    elif win_probability >= 40:
        situation = translations['balanced']
        recommendation = translations['balanced_recommendation']
    else:
        situation = translations['challenging']
        recommendation = translations['challenging_recommendation']

    summary_text = f"""
    {translations['simulation_for_lot']} <b>{lot_key}</b> {translations['shows_a_situation']} <b>{situation}</b>.
    {translations['with_a_total_score_of']} <b>{total_score:.2f}</b> {translations['points_technical']} {technical_score:.2f},
    {translations['economic']} {economic_score:.2f}{translations['and_a_discount_of']} <b>{my_discount}%</b>, {translations['the_estimated_win_probability_is']} <b>{win_probability:.1f}%</b> {translations['percent_compared_to_a_competitor']}{competitor_discount}%.
    <br/><br/>
    <b>{translations['recommendation']}</b> {recommendation}
    """
    story.append(Paragraph(summary_text, styles['BodyTextJustify']))
    story.append(Spacer(1, 0.5*cm))

    # Score gauges
    tech_gauge = create_gauge_chart(technical_score, max_tech_score, translations['technical_score'])
    econ_gauge = create_gauge_chart(economic_score, max_econ_score, translations['economic_score'])

    gauge_data = [[
        RLImage(tech_gauge, width=6*cm, height=4*cm),
        RLImage(econ_gauge, width=6*cm, height=4*cm),
    ]]
    gauge_table = Table(gauge_data, colWidths=[8.5*cm, 8.5*cm])
    gauge_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(gauge_table)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 3: TECHNICAL SCORE BREAKDOWN
    # =========================================================================

    story.append(Paragraph(translations['technical_score_analysis'], styles['SectionTitle']))
    story.append(Spacer(1, 0.5*cm))

    # Category breakdown table
    category_labels = {
        'company_certs': translations['company_certifications'],
        'resource': translations['professional_certifications'],
        'reference': translations['references'],
        'project': translations['technical_projects']
    }

    breakdown_data = [[translations['category'], translations['score'], translations['contribution_percent']]]
    total_cat_score = sum(category_scores.values())

    for cat_key, cat_label in category_labels.items():
        score = category_scores.get(cat_key, 0)
        pct = (score / technical_score * 100) if technical_score > 0 else 0
        breakdown_data.append([cat_label, f'{score:.2f}', f'{pct:.1f}%'])

    breakdown_data.append([translations['total_technical'], f'{technical_score:.2f}', '100%'])

    breakdown_table = Table(breakdown_data, colWidths=[8*cm, 4*cm, 4*cm])
    breakdown_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLORS['primary']),
        ('TEXTCOLOR', (0, 0), (-1, 0), COLORS['white']),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('BACKGROUND', (0, -1), (-1, -1), COLORS['light']),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, COLORS['muted']),
    ]))
    story.append(breakdown_table)
    story.append(Spacer(1, 0.8*cm))

    # Category chart
    chart_categories = {
        category_labels[k]: v for k, v in category_scores.items() if k in category_labels
    }
    if chart_categories:
        category_chart = create_category_breakdown_chart(chart_categories, max_tech_score)
        story.append(RLImage(category_chart, width=15*cm, height=6.5*cm))

    story.append(Spacer(1, 0.8*cm))

    # Improvement suggestions
    story.append(Paragraph(translations['areas_for_improvement'], styles['SectionTitle']))

    improvements = []
    tech_pct = (technical_score / max_tech_score * 100) if max_tech_score > 0 else 0

    if tech_pct < 70:
        improvements.append(translations['increase_company_certifications'])
    if category_scores.get('resource', 0) < category_scores.get('company_certs', 0):
        improvements.append(translations['enhance_professional_certifications'])
    if category_scores.get('reference', 0) < 5:
        improvements.append(translations['add_relevant_references'])
    if category_scores.get('project', 0) < 5:
        improvements.append(translations['highlight_successful_projects'])

    if not improvements:
        improvements.append(translations['solid_technical_profile'])

    for imp in improvements:
        story.append(Paragraph(imp, styles['BodyTextJustify']))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 4: ECONOMIC ANALYSIS
    # =========================================================================

    story.append(Paragraph(translations['economic_and_competitive_analysis'], styles['SectionTitle']))
    story.append(Spacer(1, 0.5*cm))

    # Economic summary
    econ_summary = f"""
    {translations['the_economic_offer_includes_a_discount_of']} <b>{my_discount}%</b> {translations['on_an_auction_base_of']}
    <b>€ {base_amount:,.2f}</b>, {translations['generating_an_economic_score_of']} <b>{economic_score:.2f}</b>
    {translations['points_out_of_a_maximum_of']} {max_econ_score:.0f}.
    """
    story.append(Paragraph(econ_summary.replace(',', '.'), styles['BodyTextJustify']))
    story.append(Spacer(1, 0.5*cm))

    # Monte Carlo chart
    competitor_total = (technical_score * 0.9) + (max_econ_score * 0.8)  # Estimated
    mc_chart = create_monte_carlo_chart(score_distribution, total_score,
                                        competitor_total, iterations)
    story.append(RLImage(mc_chart, width=16*cm, height=8*cm))
    story.append(Spacer(1, 0.5*cm))

    # Statistics table
    story.append(Paragraph(translations['simulation_statistics'], styles['SectionTitle']))

    stats_data = [
        [translations['metric'], translations['value']],
        [translations['iterations'], f'{iterations}'],
        [translations['mean_score'], f'{np.mean(score_distribution):.2f}'],
        [translations['minimum_score'], f'{np.min(score_distribution):.2f}'],
        [translations['maximum_score'], f'{np.max(score_distribution):.2f}'],
        [translations['standard_deviation'], f'{np.std(score_distribution):.2f}'],
        [translations['percentile_25'], f'{np.percentile(score_distribution, 25):.2f}'],
        [translations['percentile_75'], f'{np.percentile(score_distribution, 75):.2f}'],
    ]

    stats_table = Table(stats_data, colWidths=[8*cm, 6*cm])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLORS['muted']),
        ('TEXTCOLOR', (0, 0), (-1, 0), COLORS['white']),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLORS['white'], COLORS['light']]),
    ]))
    story.append(stats_table)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 5: STRATEGIC RECOMMENDATIONS
    # =========================================================================

    story.append(Paragraph(translations['strategic_recommendations'], styles['SectionTitle']))
    story.append(Spacer(1, 0.5*cm))

    # Optimal discount recommendation
    if optimal_discount is not None:
        opt_diff = optimal_discount - my_discount
        if abs(opt_diff) > 1:
            opt_text = f"""
            <b>{translations['suggested_optimal_discount']} {optimal_discount:.1f}%</b><br/><br/>
            {translations['compared_to_the_current_discount_of']} {my_discount}%, si suggerisce un
            {'aumento' if opt_diff > 0 else 'decremento'} di {abs(opt_diff):.1f} {translations['percentage_points_to_maximize']}
            """
        else:
            opt_text = f"""
            <b>{translations['current_discount_is_optimal']}</b><br/><br/>
            {translations['the_current_discount_of']} {my_discount}% {translations['is_in_line_with_the_suggested_optimization']}.
            """
    else:
        opt_text = f"""
        <b>{translations['discount_evaluation']} {my_discount}%</b><br/><br/>
        {translations['consider_the_impact_of_discount_variations']}.
        """

    opt_box_data = [[Paragraph(opt_text, styles['BodyTextJustify'])]]
    opt_box = Table(opt_box_data, colWidths=[16*cm])
    opt_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLORS['light']),
        ('BOX', (0, 0), (-1, -1), 2, COLORS['secondary']),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
    ]))
    story.append(opt_box)
    story.append(Spacer(1, 0.8*cm))

    # Pros and Cons
    story.append(Paragraph(translations['simplified_swot_analysis'], styles['SectionTitle']))

    # Generate dynamic pros/cons based on scores
    pros = []
    cons = []

    if technical_score >= max_tech_score * 0.7:
        pros.append(translations['solid_technical_profile_strength'])
    else:
        cons.append(translations['improvable_technical_profile_weakness'])

    if economic_score >= max_econ_score * 0.7:
        pros.append(translations['competitive_economic_offer_strength'])
    else:
        cons.append(translations['limited_economic_margin_weakness'])

    if win_probability >= 60:
        pros.append(translations['high_probability_of_success_strength'])
    elif win_probability < 40:
        cons.append(translations['limited_win_probability_weakness'])

    if category_scores.get('company_certs', 0) > 5:
        pros.append(translations['relevant_company_certifications_strength'])

    if category_scores.get('reference', 0) > 5:
        pros.append(translations['consolidated_references_strength'])
    else:
        cons.append(translations['references_to_be_strengthened_weakness'])

    # Ensure at least one item per column
    if not pros:
        pros.append(translations['strategic_participation_strength'])
    if not cons:
        cons.append(translations['monitor_competitive_evolution_weakness'])

    swot_data = [
        [Paragraph(f"<b>{translations['strengths']}</b>",
                  ParagraphStyle('SWOTHeader', textColor=COLORS['success'],
                                alignment=TA_CENTER, fontSize=11)),
         Paragraph(f"<b>{translations['areas_of_attention']}</b>",
                  ParagraphStyle('SWOTHeader', textColor=COLORS['danger'],
                                alignment=TA_CENTER, fontSize=11))],
        [Paragraph('<br/>'.join([f"• {p}" for p in pros]), styles['BodyTextJustify']),
         Paragraph('<br/>'.join([f"• {c}" for c in cons]), styles['BodyTextJustify'])],
    ]

    swot_table = Table(swot_data, colWidths=[8*cm, 8*cm])
    swot_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#d4edda')),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#f8d7da')),
        ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#d4edda30')),
        ('BACKGROUND', (1, 1), (1, 1), colors.HexColor('#f8d7da30')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('BOX', (0, 0), (0, -1), 1, COLORS['success']),
        ('BOX', (1, 0), (1, -1), 1, COLORS['danger']),
    ]))
    story.append(swot_table)
    story.append(Spacer(1, 0.8*cm))

    # Next Steps
    story.append(Paragraph(translations['next_steps'], styles['SectionTitle']))

    next_steps = [
        translations['validate_technical_data'],
        translations['verify_documentation_completeness'],
        translations['confirm_final_discount'],
        translations['prepare_tender_documentation'],
    ]

    if win_probability < 50:
        next_steps.insert(2, translations['evaluate_options_to_improve_technical_score'])

    for step in next_steps:
        story.append(Paragraph(step, styles['BodyTextJustify']))

    # Build PDF with custom canvas
    doc.build(story, canvasmaker=lambda *args, **kwargs:
              NumberedCanvas(*args, lot_name=lot_key, **kwargs))

    buffer.seek(0)
    return buffer