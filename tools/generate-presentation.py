"""
Generate a PowerPoint presentation explaining all Roman Imperium game systems.
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ── Colors ──
BG_DARK = RGBColor(0x0C, 0x0A, 0x18)
BG_PANEL = RGBColor(0x14, 0x12, 0x24)
BG_CARD = RGBColor(0x1E, 0x1C, 0x30)
GOLD = RGBColor(0xF0, 0xD0, 0x80)
GOLD_DIM = RGBColor(0xB4, 0xA0, 0x64)
TEXT_MAIN = RGBColor(0xE0, 0xD8, 0xC0)
TEXT_DIM = RGBColor(0xA0, 0x96, 0x82)
RED = RGBColor(0xC2, 0x4A, 0x3A)
BLUE = RGBColor(0x4A, 0x7C, 0xC2)
PURPLE = RGBColor(0x8A, 0x5C, 0xC2)
GREEN = RGBColor(0x4A, 0x9A, 0x6A)
WHITE_F = RGBColor(0xC8, 0xC0, 0xB0)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

def add_bg(slide):
    """Fill slide background with dark color."""
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = BG_DARK

def add_text(slide, left, top, width, height, text, font_size=18, color=TEXT_MAIN, bold=False, alignment=PP_ALIGN.LEFT, font_name='Segoe UI'):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = alignment
    return txBox

def add_bullet_list(slide, left, top, width, height, items, font_size=14, color=TEXT_MAIN, spacing=Pt(6)):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = item
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        p.font.name = 'Segoe UI'
        p.space_after = spacing
        p.level = 0

def add_card(slide, left, top, width, height, title, body_lines, accent_color=GOLD):
    """Add a styled card with accent top border."""
    # Card background
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
    shape.fill.solid()
    shape.fill.fore_color.rgb = BG_CARD
    shape.line.fill.background()
    shape.shadow.inherit = False
    # Accent line
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(left + 0.05), Inches(top + 0.05), Inches(width - 0.1), Inches(0.06))
    line.fill.solid()
    line.fill.fore_color.rgb = accent_color
    line.line.fill.background()
    # Title
    add_text(slide, left + 0.15, top + 0.18, width - 0.3, 0.4, title, font_size=13, color=accent_color, bold=True)
    # Body
    y = top + 0.55
    for bline in body_lines:
        add_text(slide, left + 0.15, y, width - 0.3, 0.25, bline, font_size=10, color=TEXT_DIM)
        y += 0.22

def add_divider(slide, top):
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1), Inches(top), Inches(11.333), Inches(0.01))
    line.fill.solid()
    line.fill.fore_color.rgb = GOLD_DIM
    line.line.fill.background()

def section_title(slide, number, title, subtitle=""):
    add_bg(slide)
    add_text(slide, 0.5, 0.4, 12, 0.5, f"0{number}" if number < 10 else str(number), font_size=48, color=GOLD_DIM, bold=True, font_name='Georgia')
    add_text(slide, 0.5, 1.0, 12, 0.7, title, font_size=36, color=GOLD, bold=True, font_name='Georgia')
    if subtitle:
        add_text(slide, 0.5, 1.7, 10, 0.5, subtitle, font_size=16, color=TEXT_DIM)
    add_divider(slide, 2.2)

# ═══════════════════════════════════════════════════════
# SLIDE 1 — TITLE
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
add_bg(slide)
add_text(slide, 0.5, 1.5, 12.333, 1.0, "ROMAN IMPERIUM", font_size=54, color=GOLD, bold=True, font_name='Georgia', alignment=PP_ALIGN.CENTER)
add_text(slide, 0.5, 2.5, 12.333, 0.6, "Game Systems Architecture", font_size=28, color=TEXT_DIM, font_name='Georgia', alignment=PP_ALIGN.CENTER)
add_divider(slide, 3.3)
add_text(slide, 0.5, 3.8, 12.333, 0.4, "A Roguelike Grand Strategy Game", font_size=18, color=GOLD_DIM, alignment=PP_ALIGN.CENTER)
add_bullet_list(slide, 3, 4.5, 7.333, 2.5, [
    "TypeScript + Preact + WebGL2",
    "Hex-based tactical combat  |  Province management  |  Event-driven narrative",
    "4 Commanders  |  15 Advisors  |  18 Doctrines  |  30 Scrolls  |  47 Events",
    "24-season doom clock  |  Meta-save progression",
], font_size=14, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 2 — GAME LOOP OVERVIEW
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 1, "Core Game Loop", "The player's journey through a single run")

# Flow boxes
flow_items = [
    ("1. SELECT", "Pick Commander\n4 factions, unique abilities", GOLD),
    ("2. HUB", "Prepare at Base Camp\nSeat advisors, equip doctrines", BLUE),
    ("3. SPOKE", "Embark on Campaign\nBattle, Rest, Event, Boss nodes", RED),
    ("4. BATTLE", "Hex Tactical Combat\n20x14 grid, 3 unit roles", RED),
    ("5. PROVINCE", "Conquer & Invest\n6 investment types, governors", GREEN),
    ("6. ENDGAME", "Final Invasion at S24\nVictory or Defeat", PURPLE),
]
x = 0.4
for title, body, color in flow_items:
    add_card(slide, x, 2.8, 2.0, 2.2, title, body.split('\n'), accent_color=color)
    x += 2.1
# Arrow hints
add_text(slide, 0.5, 5.3, 12, 0.4, "Hub  \u2192  Spoke  \u2192  Battle  \u2192  Province  \u2192  Hub  (repeat until Season 24 \u2192 Final Invasion)", font_size=12, color=TEXT_DIM, alignment=PP_ALIGN.CENTER)

# ═══════════════════════════════════════════════════════
# SLIDE 3 — COMMANDERS
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 2, "Commander System", "4 playable commanders, each with unique faction identity")

commanders = [
    ("Pope Innocent", "Gold (Faith)", "Call Crusade", "+30% dmg for 3 battles", "Miracle", "Heal/Smite", "3g 2f 0i 0m", GOLD),
    ("Boudicca", "Red (Momentum)", "War Cry", "Instant first strike", "Fury Charge", "All units lunge + impact", "2g 0f 0i 3m", RED),
    ("Augustus", "Blue (Influence)", "Manipulate", "Reroll node outcome", "Turncoat", "Convert enemy unit", "2g 0f 2i 0m", BLUE),
    ("Marcus Crassus", "Purple (Gold)", "Golden Opportunity", "+2 rest nodes in spoke", "Buy Reinforcements", "Deploy mercenary (2 max)", "8g 0f 0i 0m", PURPLE),
]
y = 2.6
for name, faction, strat, strat_desc, tact, tact_desc, res, color in commanders:
    add_card(slide, 0.4, y, 3.0, 1.0, name, [f"Faction: {faction}", f"Strategic: {strat} \u2014 {strat_desc}", f"Tactical: {tact} \u2014 {tact_desc}"], accent_color=color)
    y += 1.1

add_text(slide, 4.0, 2.6, 5, 0.3, "Faction Primary Resources (2x income):", font_size=13, color=GOLD, bold=True)
faction_res = [
    ("Gold \u2192 Faith", GOLD), ("Red \u2192 Momentum", RED),
    ("Blue \u2192 Influence", BLUE), ("Purple \u2192 Gold", PURPLE),
    ("White \u2192 None (universal)", WHITE_F),
]
y = 3.0
for text, color in faction_res:
    add_text(slide, 4.2, y, 4, 0.25, text, font_size=12, color=color)
    y += 0.28

add_text(slide, 4.0, 4.6, 5, 0.3, "Color-Lock Rules:", font_size=13, color=GOLD, bold=True)
add_bullet_list(slide, 4.2, 4.9, 5, 1.5, [
    "Commanders equip items matching faction OR white",
    "White commander can use ANY color",
    "Advisors are UNRESTRICTED (any color for any commander)",
], font_size=11, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 4 — RESOURCE & ECONOMY
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 3, "Resource & Economy System", "4 resources drive all strategic decisions")

resources = [
    ("Gold", "Universal currency. Build, trade, hire.", GOLD),
    ("Faith", "Religious actions, healing, divine scrolls.", GOLD),
    ("Influence", "Diplomacy, alliances, political scrolls.", BLUE),
    ("Momentum", "Military aggression, charge abilities.", RED),
]
x = 0.5
for name, desc, color in resources:
    add_card(slide, x, 2.6, 2.9, 1.0, name, [desc], accent_color=color)
    x += 3.1

add_text(slide, 0.5, 3.9, 6, 0.3, "Economy Mechanics:", font_size=14, color=GOLD, bold=True)
add_bullet_list(slide, 0.7, 4.3, 6, 2.5, [
    "Faction primary resource earns 2x from all sources",
    "Income modifiers stack additively, capped at +75%",
    "Exchange: Primary 2:2, Non-primary 3:2 + Market bonus",
    "War Profiteer (Crassus): +50% gold from all sources",
    "Upkeep: base 2g + doom escalation (+1g per 25% doom)",
], font_size=12, color=TEXT_DIM)

add_text(slide, 7, 3.9, 6, 0.3, "Upkeep Scaling (Doom):", font_size=14, color=GOLD, bold=True)
doom_levels = [
    "Doom 0-24%:   base upkeep (2g + 1f/season)",
    "Doom 25-49%:  +1g   (frontier restless)",
    "Doom 50-74%:  +2g   (tribes uniting)",
    "Doom 75-99%:  +3g   (horde assembles)",
    "Doom 100%:    FINAL INVASION",
]
add_bullet_list(slide, 7.2, 4.3, 5.5, 2.5, doom_levels, font_size=12, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 5 — SPOKE / CAMPAIGN
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 4, "Spoke & Campaign System", "Linear node sequences forming the campaign structure")

node_types = [
    ("Battle", "Hex tactical combat. Win to progress.", RED),
    ("Rest", "+2 primary resource, +1 random secondary", GREEN),
    ("Event", "Narrative choice with consequences", GOLD),
    ("Boss", "Harder battle, end of spoke", PURPLE),
]
x = 0.5
for name, desc, color in node_types:
    add_card(slide, x, 2.6, 3.0, 0.9, f"Node: {name}", [desc], accent_color=color)
    x += 3.1

add_text(slide, 0.5, 3.8, 6, 0.3, "Spoke Generation:", font_size=14, color=GOLD, bold=True)
add_bullet_list(slide, 0.7, 4.2, 6, 2.5, [
    "Node weights determined by seated Advisors",
    "Duration: 1-4 seasons (from advisor template)",
    "Posture: Attacking (+1g +1m upkeep) or Defending",
    "75% nodes match preview, 25% randomized by threat",
    "Completion: conquers a province, grants advisor XP",
], font_size=12, color=TEXT_DIM)

add_text(slide, 7, 3.8, 6, 0.3, "Season Clock:", font_size=14, color=GOLD, bold=True)
add_bullet_list(slide, 7.2, 4.2, 5.5, 2.5, [
    "Global counter: 0 \u2192 24 seasons max",
    "Advances within spokes on node thresholds",
    "Each tick: +1 threat, upkeep drain, province income",
    "Season 24 = Final Invasion (mandatory boss)",
    "Faster completion = higher score (speed bonus)",
], font_size=12, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 6 — BATTLE SYSTEM
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 5, "Battle System", "Semi-real-time hex tactical combat on a 20\u00d714 grid")

roles = [
    ("Vanguard", "ATK 150 | DEF 40 | HP 1080 | AGI 40", "Frontline heavy hitter", RED),
    ("Reserve", "ATK 130 | DEF 50 | HP 840 | AGI 70", "Fast mid-range flanker", BLUE),
    ("Guard", "ATK 100 | DEF 80 | HP 1200 | AGI 30", "Defensive anchor", GOLD),
]
x = 0.5
for name, stats, desc, color in roles:
    add_card(slide, x, 2.6, 3.9, 1.0, f"Role: {name}", [stats, desc], accent_color=color)
    x += 4.1

add_text(slide, 0.5, 3.9, 6, 0.3, "Combat Mechanics:", font_size=14, color=GOLD, bold=True)
add_bullet_list(slide, 0.7, 4.3, 5.5, 2.5, [
    "D6 roll \u00d7 ATK - DEF (minimum 1 damage)",
    "Dodge: (def_AGI - atk_AGI) \u00d7 0.5, capped at 30%",
    "Double Strike: ATK.agi \u2265 DEF.agi \u00d7 1.5",
    "Action cooldown: 1.4s base (semi-real-time)",
    "Move range: 3 hexes per action",
], font_size=12, color=TEXT_DIM)

add_text(slide, 7, 3.9, 6, 0.3, "Victory Conditions:", font_size=14, color=GOLD, bold=True)
add_bullet_list(slide, 7.2, 4.3, 5.5, 2.5, [
    "Capture: hold enemy star hex for 3 seconds",
    "Morale: break enemy below 30% total HP",
    "Annihilation: eliminate all enemy units",
    "VFX: particles on hit/death, screen shake on kills",
    "Veteran Bonus (Boudicca): +4%/stack, soft cap at 12",
], font_size=12, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 7 — COUNCIL & ADVISORS
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 6, "Council & Advisor System", "15 advisors shape spoke generation, combat, and economy")

add_text(slide, 0.5, 2.6, 12, 0.3, "3 Council Slots \u2014 Seat advisors to shape your campaign. Color UNRESTRICTED.", font_size=14, color=TEXT_MAIN)

advisor_groups = [
    ("Military (Red)", ["Centurion Varro \u2014 +loot%", "Siege Master Titus \u2014 +Momentum/spoke", "Raider Brennus \u2014 +loot, short spokes"], RED),
    ("Diplomatic (Blue)", ["Legate Aemilia \u2014 +event choices", "Scholar Ptolemy \u2014 +Influence/spoke", "Spymaster Cassia \u2014 -threat/spoke"], BLUE),
    ("Religious (Gold)", ["Pontifex Lucius \u2014 +Faith/spoke", "Healer Cornelia \u2014 heal between nodes", "Zealot Marcus \u2014 +Faith, aggressive"], GOLD),
    ("Economic (Purple)", ["Merchant Decimus \u2014 +Gold/spoke", "Quartermaster Livia \u2014 -upkeep%", "Smuggler Gaius \u2014 shop discount"], PURPLE),
    ("Populist (White)", ["Tribune Publius \u2014 +loot%", "Veteran Flavia \u2014 heal between nodes", "Consul Servius \u2014 +Influence/spoke"], WHITE_F),
]
x = 0.3
for group_name, advisors, color in advisor_groups:
    add_card(slide, x, 3.1, 2.4, 1.8, group_name, advisors, accent_color=color)
    x += 2.5

add_text(slide, 0.5, 5.2, 12, 0.3, "Progression:", font_size=13, color=GOLD, bold=True)
add_text(slide, 0.5, 5.5, 12, 0.3, "3 Tiers per advisor  |  XP thresholds: Tier 2 = 5 XP, Tier 3 = 12 XP  |  +1 XP per spoke completed  |  Each tier upgrades passive + spoke template", font_size=11, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 8 — DOCTRINES
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 7, "Doctrine System", "18 equippable doctrines with 3-level upgrades (4 equip slots)")

doctrine_groups = [
    ("Red \u2014 Military (5)", ["Sword of War: +dmg%", "Iron Discipline: +armor%", "Blood Rite: heal on kill", "Lex Militaris: free vanguards", "Vis Bellica: combined buffs"], RED),
    ("Blue \u2014 Diplomatic (5)", ["Diplomacy: +Inf/spoke", "Court: +event choices", "Alliances: +allied units", "Pax Romana: Inf + discount", "Foedus: allies + gold income"], BLUE),
    ("Gold \u2014 Religious (4)", ["Faith: +Faith/spoke", "Miracles: heal at battle start", "Pantheon: unit revive", "Divina: Faith + revive"], GOLD),
    ("Purple \u2014 Economic (4)", ["Trade: +gold income%", "Infrastructure: -upkeep%", "Market: -shop price%", "Annona: regional bonuses"], PURPLE),
]
x = 0.4
for group_name, items, color in doctrine_groups:
    add_card(slide, x, 2.6, 3.0, 2.0, group_name, items, accent_color=color)
    x += 3.15

add_text(slide, 0.5, 4.9, 12, 0.3, "Upgrade Cost: Gold + faction resource  |  Sell Price: 8g + 4g/level  |  Color-locked to faction (white = universal)  |  Level I \u2192 II \u2192 III", font_size=11, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 9 — DECRETUM SCROLLS
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 8, "Decretum System", "30 magic scrolls \u2014 tactical spells cast during battle")

scroll_groups = [
    ("Red \u2014 Military (6)", ["Forge: +20% DEF", "Legion: spawn 2 vanguards", "Mars: +60% ATK (2 Momentum)", "Gladius: +15% ATK", "Testudo: +40% DEF"], RED),
    ("Blue \u2014 Diplomatic (6)", ["Tribune: favorable event", "Senate: +3 Influence", "Legatus: convert enemy (1 Inf)", "Spy: reveal all enemies", "Foedus: +2 Influence"], BLUE),
    ("Gold \u2014 Religious (6)", ["Healing: heal all 30%", "Oracle: prevent death (1 Faith)", "Augur: reveal node choices", "Pontifex: full heal (single)", "Pietas: +3 Momentum"], GOLD),
    ("Purple \u2014 Economic (6)", ["Tax: +3 Gold", "Merchant: +5 Gold", "Cursus: +10g + 50% discount", "Supply: -upkeep 1 season", "Aerarium: +4 Gold"], PURPLE),
]
x = 0.4
for group_name, items, color in scroll_groups:
    add_card(slide, x, 2.6, 3.0, 2.0, group_name, items, accent_color=color)
    x += 3.15

add_text(slide, 0.5, 4.9, 12, 0.5, "Rarity: Common (sell 2g) | Rare (sell 5g) | Legendary (sell 10g, has cast cost)  |  Hand limit: 3 scrolls  |  Cast = consume scroll + pay cost + apply effect", font_size=11, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 10 — PROVINCES & GOVERNORS
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 9, "Province & Governor System", "Conquer territory, invest in infrastructure, hire governors")

investments = [
    ("Castrum", "Garrison: -unrest, +militia", RED),
    ("Basilica", "Court: +Influence/spoke", BLUE),
    ("Pantheon", "Holy: +Faith/spoke, revive", GOLD),
    ("Market", "Trade: +Gold/spoke", PURPLE),
    ("Aqueduct", "Growth: +Gold, +pop cap", PURPLE),
    ("Insula", "Housing: -unrest", WHITE_F),
]
x = 0.3
for name, desc, color in investments:
    add_card(slide, x, 2.6, 2.0, 1.0, name, [desc, "3 upgrade levels"], accent_color=color)
    x += 2.1

add_text(slide, 0.5, 3.9, 6, 0.3, "Province Stats:", font_size=14, color=GOLD, bold=True)
add_bullet_list(slide, 0.7, 4.3, 5.5, 2.5, [
    "Population: 1-10 (scales income)",
    "Base Income: varies per province",
    "Unrest: 0-100 (rebellion at threshold)",
    "Conquered on spoke completion",
], font_size=12, color=TEXT_DIM)

add_text(slide, 7, 3.9, 6, 0.3, "Governor Traits:", font_size=14, color=GOLD, bold=True)
add_bullet_list(slide, 7.2, 4.3, 5.5, 2.5, [
    "Income bonus: +X% per resource",
    "Expense reduction: -X% upkeep",
    "Unrest reduction: -X flat/spoke",
    "Investment discount: -X% build costs",
    "3 hiring tiers with increasing cost",
], font_size=12, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 11 — EVENTS
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 10, "Event System", "47 narrative events with branching choices and consequences")

add_text(slide, 0.5, 2.6, 6, 0.3, "Event Pool by Type:", font_size=14, color=GOLD, bold=True)
event_groups = [
    ("Neutral (16)", "Any commander. 3 tiers by threat level.", TEXT_MAIN),
    ("Red Military (6)", "War-themed: deserters, arms dealers, mutiny", RED),
    ("Blue Diplomatic (6)", "Political: embassy, betrayal, senate session", BLUE),
    ("Gold Religious (6)", "Divine: temple, heretic, omens, relics", GOLD),
    ("Purple Economic (6)", "Trade: caravans, tax, market speculation", PURPLE),
    ("White Populist (4+)", "People: crowds, populism, grain dole", WHITE_F),
]
y = 3.0
for name, desc, color in event_groups:
    add_text(slide, 0.7, y, 3, 0.25, name, font_size=12, color=color, bold=True)
    add_text(slide, 3.5, y, 4, 0.25, desc, font_size=11, color=TEXT_DIM)
    y += 0.32

add_text(slide, 7, 2.6, 6, 0.3, "Event Structure:", font_size=14, color=GOLD, bold=True)
add_bullet_list(slide, 7.2, 3.0, 5.5, 3.5, [
    "Requirements: minThreat, minProvinces, minResource",
    "Choices: 2-4 options with resource costs/gains",
    "Consequence flags: unlock follow-up events",
    "Tier progression: Tier 1 (start), Tier 2 (threat\u22653), Tier 3 (\u22656)",
    "Doctrine bonus: extra event choices (+1 to +3)",
    "Decretum modifier: force favorable outcome",
    "Example chain: Refugees \u2192 Refugees Give Thanks",
], font_size=12, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 12 — THREAT & FINAL INVASION
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 11, "Doom Clock & Final Invasion", "24-season campaign with escalating threat")

add_text(slide, 0.5, 2.6, 6, 0.3, "Threat Scaling:", font_size=14, color=GOLD, bold=True)
add_bullet_list(slide, 0.7, 3.0, 5.5, 2.5, [
    "Enemy stats: +5% HP/ATK per threat level",
    "Extra enemies at threat \u2265 5 (+1 raider)",
    "Extra enemies at threat \u2265 8 (+2 raiders)",
    "Retreat from spoke: +1 threat penalty",
], font_size=12, color=TEXT_DIM)

add_text(slide, 7, 2.6, 6, 0.3, "Final Boss Scaling (Season 24):", font_size=14, color=GOLD, bold=True)
add_bullet_list(slide, 7.2, 3.0, 5.5, 2.5, [
    "Base multiplier: 1.5x stats",
    "+0.05 per province (more territory = harder boss)",
    "-0.05 per alliance (allies = mercy scaling)",
    "-0.03 per battle won (veteran = easier)",
    "+0.02 per threat above 15 (dragged out = punished)",
    "Clamped: 1.3x \u2013 2.5x final multiplier",
    "Spawn: 4 + 1 per 3 provinces (max 6 invasion units)",
], font_size=12, color=TEXT_DIM)

add_text(slide, 0.5, 5.2, 12, 0.3, "Scoring:", font_size=13, color=GOLD, bold=True)
add_text(slide, 0.5, 5.5, 12, 0.4, "Score = (victory ? 1000 : 0) + battles\u00d775 + provinces\u00d7200 + (victory ? (24-seasons)\u00d7100 : 0)  \u2014  Faster wins = higher score", font_size=12, color=TEXT_DIM)

# ═══════════════════════════════════════════════════════
# SLIDE 13 — TECHNICAL ARCHITECTURE
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 12, "Technical Architecture", "TypeScript + Preact + WebGL2 + Canvas 2D")

tech_cards = [
    ("UI Layer", ["Preact + Signals (reactive)", "Hash-based routing (12 screens)", "Injected CSS animations", "Screen transitions (200ms exit, 300ms enter)"], BLUE),
    ("Battle Engine", ["Canvas 2D renderer (873 lines)", "20x14 hex grid, pointy-top", "Particle system + screen shake", "Semi-real-time AI (1.4s cooldown)"], RED),
    ("Game State", ["Signal-based stores", "Province/Governor/Council signals", "Strategic ability store", "Meta-save (localStorage)"], GREEN),
    ("Sound", ["Web Audio API (procedural synth)", "14 SFX effects (no MP3 needed)", "Music crossfade per screen", "Mute toggle (starts muted)"], PURPLE),
    ("Map Renderer", ["WebGL2 uber-shader", "5-layer compositing", "Province color LUT", "Click detection via FBO readback"], GOLD),
]
x = 0.3
for title, items, color in tech_cards:
    add_card(slide, x, 2.6, 2.4, 2.4, title, items, accent_color=color)
    x += 2.55

add_text(slide, 0.5, 5.3, 12, 0.3, "81 TypeScript files  |  69 modules  |  283 KB bundle (71 KB gzip)  |  Zero runtime dependencies", font_size=12, color=TEXT_DIM, alignment=PP_ALIGN.CENTER)

# ═══════════════════════════════════════════════════════
# SLIDE 14 — SYSTEM INTERCONNECTIONS
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 13, "System Interconnections", "How all systems feed into each other")

connections = [
    "Advisor \u2192 Spoke Generation: advisor templates shape node distribution + duration",
    "Doctrine \u2192 Combat + Economy: effects modify unit stats, upkeep, income, shop prices",
    "Province Investments \u2192 Income + Unrest: 6 types unlock bonuses or suppress unrest",
    "Governor Traits \u2192 Province Stats: hired governors add % bonuses/reductions",
    "Events \u2192 Consequence Flags: events unlock follow-up events via state flags",
    "Threat Level \u2192 Event Eligibility: higher threat unlocks harder events",
    "Doom Clock \u2192 Upkeep Drain: every 6 seasons = +1g additional upkeep",
    "Strategic Abilities \u2192 Battle/Spoke: shape combat (Crusade/WarCry) or spoke (Manipulate/GoldenOpp)",
    "Decretum Scrolls \u2192 Battle Tactics: color-locked spells for in-battle power-ups",
    "Meta-Save \u2192 Run History: score from outcome + battles + provinces + speed",
]

y = 2.6
for conn in connections:
    parts = conn.split(': ', 1)
    add_text(slide, 0.7, y, 4.5, 0.25, parts[0], font_size=12, color=GOLD, bold=True)
    add_text(slide, 5.5, y, 7, 0.25, parts[1] if len(parts) > 1 else '', font_size=11, color=TEXT_DIM)
    y += 0.4

# ═══════════════════════════════════════════════════════
# SLIDE 15 — NUMBERS AT A GLANCE
# ═══════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_title(slide, 14, "By the Numbers", "Quantified game content summary")

stats_left = [
    ("4", "Playable Commanders"),
    ("15", "Advisors (5 factions \u00d7 3)"),
    ("18", "Doctrines (3 levels each)"),
    ("30", "Decretum Scrolls"),
    ("47", "Narrative Events"),
    ("6", "Investment Types"),
    ("4", "NPC Factions"),
]
stats_right = [
    ("3", "Unit Roles (Vanguard, Reserve, Guard)"),
    ("3", "Victory Modes (Capture, Morale, Annihilation)"),
    ("4", "Resource Types"),
    ("24", "Max Seasons (Doom Clock)"),
    ("14", "Procedural SFX Effects"),
    ("12", "Game Screens"),
    ("10", "Development Sprints"),
]

y = 2.6
for num, label in stats_left:
    add_text(slide, 1.0, y, 1.2, 0.35, num, font_size=28, color=GOLD, bold=True, alignment=PP_ALIGN.RIGHT, font_name='Georgia')
    add_text(slide, 2.4, y + 0.05, 4, 0.3, label, font_size=14, color=TEXT_DIM)
    y += 0.45

y = 2.6
for num, label in stats_right:
    add_text(slide, 7.5, y, 1.2, 0.35, num, font_size=28, color=GOLD, bold=True, alignment=PP_ALIGN.RIGHT, font_name='Georgia')
    add_text(slide, 8.9, y + 0.05, 4, 0.3, label, font_size=14, color=TEXT_DIM)
    y += 0.45

# ═══════════════════════════════════════════════════════
# SAVE
# ═══════════════════════════════════════════════════════
output_path = 'Roman_Imperium_Game_Systems.pptx'
prs.save(output_path)
print(f'Presentation saved: {output_path}')
print(f'Slides: {len(prs.slides)}')
