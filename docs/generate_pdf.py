#!/usr/bin/env python3
"""Sistem Absensi LT — PDF laporan, minimal-Swiss professional (white, ink, 1 navy accent)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage
import os

# ---------- Fonts ----------
G  = '/System/Library/Fonts/Supplemental/Georgia.ttf'
GB = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
AV = '/System/Library/Fonts/Avenir.ttc'
pdfmetrics.registerFont(TTFont('Georgia', G))
pdfmetrics.registerFont(TTFont('GeorgiaB', GB))
pdfmetrics.registerFont(TTFont('Avenir', AV, subfontIndex=0))
pdfmetrics.registerFont(TTFont('AvenirMedium', AV, subfontIndex=8))
pdfmetrics.registerFont(TTFont('AvenirHeavy', AV, subfontIndex=4))
pdfmetrics.registerFontFamily('Georgia', normal='Georgia', bold='GeorgiaB')

BASE = os.path.dirname(os.path.abspath(__file__))
SHOT = os.path.join(BASE, 'screenshots')
OUT = os.path.join(os.path.dirname(BASE), 'docs', 'Sistem-Absensi-LT.pdf')

# ---------- Minimal palette: white + ink + gray + ONE navy accent ----------
BG       = HexColor('#FFFFFF')
INK      = HexColor('#161616')
MUTED    = HexColor('#6D6D6D')
FAINT    = HexColor('#ABABAB')
LINE     = HexColor('#E6E6E6')
ACCENT   = HexColor('#2E4A6B')   # single muted navy
CARD     = HexColor('#FFFFFF')
WHITE    = HexColor('#FFFFFF')

PAGE_W, PAGE_H = A4
MARGIN = 22*mm
CW = PAGE_W - 2*MARGIN

# ---------- Styles ----------
body = ParagraphStyle('body', fontName='Avenir', fontSize=9.8, leading=15.2,
                      textColor=INK, alignment=TA_LEFT)
bodyj = ParagraphStyle('bodyj', parent=body, alignment=TA_JUSTIFY)
small = ParagraphStyle('small', parent=body, fontSize=8.6, leading=12.5, textColor=MUTED)
eyebrow = ParagraphStyle('eyebrow', fontName='AvenirMedium', fontSize=8.8, leading=11.5,
                         textColor=MUTED)
h2 = ParagraphStyle('h2', fontName='Georgia', fontSize=15, leading=18.5, textColor=INK)
h3 = ParagraphStyle('h3', fontName='Georgia', fontSize=12, leading=15.5, textColor=INK)
sub = ParagraphStyle('sub', parent=body, fontSize=9, leading=13.5, textColor=MUTED)
cap = ParagraphStyle('cap', fontName='AvenirMedium', fontSize=8.4, leading=11.5,
                     textColor=FAINT, alignment=TA_CENTER)
li = ParagraphStyle('li', parent=body, leftIndent=6*mm, bulletIndent=1*mm, spaceBefore=1.5)
thc = ParagraphStyle('thc', fontName='GeorgiaB', fontSize=8.8, leading=11.5,
                     textColor=INK, alignment=TA_LEFT)
tcell = ParagraphStyle('tcell', fontName='Avenir', fontSize=8.8, leading=12, textColor=INK)

# ---------- Flowables ----------
class SectionHead(Flowable):
    """Quiet header: small number (navy) + serif title + hairline + subtitle."""
    def __init__(self, number, title, subtitle=None, width=CW):
        super().__init__()
        self.number, self.title, self.subtitle, self.width = number, title, subtitle, width
    def wrap(self, *a): return self.width, 20*mm
    def draw(self):
        c = self.canv
        c.setFillColor(ACCENT); c.setFont('AvenirHeavy', 9)
        c.drawString(0, 16.2*mm, self.number)
        c.setFillColor(INK); c.setFont('GeorgiaB', 15.5)
        c.drawString(0, 9.6*mm, self.title)
        c.setStrokeColor(LINE); c.setLineWidth(0.5)
        c.line(0, 7.2*mm, self.width, 7.2*mm)
        if self.subtitle:
            c.setFillColor(MUTED); c.setFont('Avenir', 9)
            c.drawString(0, 3.4*mm, self.subtitle)

class Frame(Flowable):
    """Thin-bordered screenshot frame (no rounding, no tick, no shadow) + caption below."""
    def __init__(self, filename, caption, width, target_w=None):
        super().__init__()
        self.filename = os.path.join(SHOT, filename)
        self.caption = caption
        self.width = width
        self.pad = 2.5*mm
        self.target_w = target_w or (width - 2*self.pad)
        im = PILImage.open(self.filename); self.iw, self.ih = im.size
        self.img_w = self.target_w
        self.img_h = self.target_w * self.ih / self.iw
        self.cap_h = 8*mm
    def wrap(self, *a): return self.width, self.img_h + 2*self.pad + self.cap_h
    def draw(self):
        c = self.canv
        w, h = self.width, self.img_h + 2*self.pad + self.cap_h
        c.setStrokeColor(LINE); c.setLineWidth(0.6)
        c.rect(0, self.cap_h + self.pad, self.img_w + 2*self.pad, self.img_h + 2*self.pad, stroke=1, fill=0)
        io_x = self.pad; io_y = self.cap_h + self.pad
        c.drawImage(self.filename, io_x, io_y, width=self.img_w, height=self.img_h, preserveAspectRatio=True, mask=None)
        c.setFillColor(FAINT); c.setFont('Avenir', 8.4)
        c.drawCentredString(w/2, self.cap_h*0.4, self.caption)

def para(t, st=body): return Paragraph(t, st)

def make_table(header, rows, colWidths):
    data = [[Paragraph(h, thc) for h in header]]
    for r in rows:
        data.append([Paragraph(str(c), tcell) for c in r])
    t = Table(data, colWidths=colWidths, repeatRows=1)
    t.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,0), 1.0, ACCENT),
        ('INNERGRID', (0,-1), (-1,-1), 0.4, LINE),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5.5), ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('BOTTOMPADDING', (0,-1), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 0), ('RIGHTPADDING', (0,0), (-1,-1), 6*mm)]))
    return t

def split_cols(left, right, lw=0.42, gap=10*mm):
    colW = [CW*lw, CW*(1-lw)]
    t = Table([[left if isinstance(left, list) else [left],
                right if isinstance(right, list) else [right]]], colWidths=colW)
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),
                           ('LEFTPADDING',(0,0),(-1,-1),0), ('RIGHTPADDING',(0,0),(-1,-1),0),
                           ('TOPPADDING',(0,0),(-1,-1),0), ('BOTTOMPADDING',(0,0),(-1,-1),0),
                           ('RIGHTPADDING',(0,0),(0,0),gap)]))
    return t

# ---------- Backgrounds ----------
def cover_bg(c, doc):
    c.saveState()
    c.setFillColor(BG); c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(ACCENT); c.rect(0, 0, 4*mm, PAGE_H, stroke=0, fill=1)
    c.restoreState()

def page_bg(c, doc):
    c.saveState()
    c.setFillColor(BG); c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setStrokeColor(LINE); c.setLineWidth(0.5); c.line(MARGIN, 15*mm, PAGE_W-MARGIN, 15*mm)
    c.setFillColor(FAINT); c.setFont('AvenirMedium', 7.4)
    c.drawString(MARGIN, 10.5*mm, 'Sistem Absensi LT · MTsN 1 Kebumen')
    c.drawRightString(PAGE_W-MARGIN, 10.5*mm, 'Dokumen Sistem · v2.0')
    c.setFillColor(ACCENT); c.setFont('AvenirHeavy', 8.5)
    c.drawRightString(PAGE_W-MARGIN, PAGE_H-13*mm, str(doc.page))
    c.restoreState()

# ---------- Build ----------
# ===== Diagram helpers (sitemap, annotated, flow) =====
class Sitemap(Flowable):
    """Peta situs: root -> Admin & Guru -> halaman anak. Box header navy + nomor + deskripsi."""
    def __init__(self, width=CW):
        super().__init__()
        self.width = width
    def wrap(self, *a): self._h = 128*mm; return self.width, self._h
    def _box(self, c, x, y, w, h, header, num, desc, hcolor=ACCENT):
        c.setFillColor(CARD); c.setStrokeColor(ACCENT); c.setLineWidth(0.8)
        c.rect(x, y, w, h, stroke=1, fill=1)
        c.setFillColor(hcolor); c.rect(x, y+h-5*mm, w, 5*mm, stroke=0, fill=1)
        c.setFillColor(WHITE); c.setFont('AvenirHeavy', 7.6)
        c.drawString(x+2*mm, y+h-4*mm, header)
        c.setFillColor(INK); c.setFont('AvenirMedium', 7)
        c.drawString(x+2*mm, y+h-11*mm, num)
        c.setFillColor(MUTED); c.setFont('Avenir', 6.6)
        c.drawString(x+2*mm, y+2*mm, desc)
    def _line(self, c, x1,y1,x2,y2):
        c.setStrokeColor(ACCENT); c.setLineWidth(1)
        c.line(x1,y1,x2,y2)
    def draw(self):
        c=self.canv; W=self.width
        # root
        root_x=W/2-28*mm; root_y=self._h-16*mm
        self._box(c, root_x, root_y, 56*mm, 14*mm, 'LOGIN', '0.0', 'username + password', ACCENT)
        mid_y=root_y-4*mm
        self._line(c, W/2, root_y, W/2, mid_y)
        # columns
        colW=76*mm; gap=8*mm; left_w= W/2-gap/2; right_x= W/2+gap/2
        # horizontal connector
        hline_y=mid_y-2*mm
        self._line(c, left_w+colW/2, mid_y, W/2, mid_y)
        self._line(c, W/2, mid_y, right_x+colW/2, mid_y)
        # Admin column
        y=hline_y-4*mm
        self._box(c, left_w, y, colW, 14*mm, 'SISI ADMIN', '1.0', 'Kelola seluruh sistem', ACCENT)
        self._line(c, left_w+colW/2, hline_y, left_w+colW/2, y+14*mm)
        admin=[('Dashboard','1.1','Monitoring kehadiran & tren'),('Manajemen Guru','1.2','CRUD guru, role, reset, hapus'),
               ('Data Absensi','1.3','Filter & ekspor Excel'),('Kelas & Shift','1.4','Keduanya dinamis'),
               ('Audit Log','1.5','Jejak aktivitas'),('Profil','1.6','Ganti password, foto')]
        y-=16*mm
        for hdr,num,desc in admin:
            self._box(c, left_w, y, colW, 13*mm, hdr, num, desc, ACCENT)
            self._line(c, left_w+colW/2, y+13*mm, left_w+colW/2, y+16*mm)
            y-=16*mm
        # Guru column
        y=hline_y-4*mm
        self._box(c, right_x, y, colW, 14*mm, 'SISI GURU', '2.0', 'Pengguna harian', ACCENT)
        self._line(c, right_x+colW/2, hline_y, right_x+colW/2, y+14*mm)
        guru=[('Dashboard','2.1','Ringkasan kehadiran pribadi'),('Absensi','2.2','Input kehadiran + foto'),
              ('Histori','2.3','Riwayat per bulan'),('Profil','2.4','Ubah data, foto, password')]
        y-=16*mm
        for hdr,num,desc in guru:
            self._box(c, right_x, y, colW, 13*mm, hdr, num, desc, ACCENT)
            self._line(c, right_x+colW/2, y+13*mm, right_x+colW/2, y+16*mm)
            y-=16*mm

class FlowBox(Flowable):
    def __init__(self, title, sub, width, accent=ACCENT, h=14*mm):
        super().__init__()
        self.title, self.sub, self.width, self.accent, self.h = title, sub, width, accent, h
    def wrap(self, *a): return self.width, self.h
    def draw(self):
        c=self.canv; w,h=self.width,self.h
        c.setFillColor(CARD); c.setStrokeColor(self.accent); c.setLineWidth(0.8)
        c.rect(0,0,w,h,stroke=1,fill=1)
        c.setFillColor(self.accent); c.rect(0,0,2*mm,h,stroke=0,fill=1)
        c.setFillColor(INK); c.setFont('AvenirMedium', 8)
        c.drawString(4*mm, h-5.5*mm, self.title)
        c.setFillColor(MUTED); c.setFont('Avenir', 6.8)
        c.drawString(4*mm, 2.5*mm, self.sub)

def arrow(c, x1, y1, x2, y2):
    c.setStrokeColor(ACCENT); c.setLineWidth(1.2)
    c.line(x1,y1,x2,y2)
    import math
    ax,ay=x2,y2; ang=math.atan2(y2-y1,x2-x1); n=2.4*mm
    c.line(ax,ay, ax-n*math.cos(ang+0.5), ay-n*math.sin(ang+0.5))
    c.line(ax,ay, ax-n*math.cos(ang-0.5), ay-n*math.sin(ang-0.5))

class FlowDiagram(Flowable):
    """Alur: 4 kotak sebaris + panah, lalu 1 hasil di bawah."""
    def __init__(self, steps, result, width=CW):
        super().__init__()
        self.steps, self.result, self.width = steps, result, width
    def wrap(self, *a): self._h = 46*mm; return self.width, self._h
    def draw(self):
        c=self.canv; W=self.width
        n=len(self.steps); arrow_gap=12*mm
        bw=(W-(n-1)*arrow_gap)/n
        bh=15*mm; top_y=self._h-4*mm-bh
        for i,(title,sub) in enumerate(self.steps):
            x=i*(bw+arrow_gap)
            c.setFillColor(CARD); c.setStrokeColor(ACCENT); c.setLineWidth(0.8)
            c.rect(x, top_y, bw, bh, stroke=1, fill=1)
            c.setFillColor(ACCENT); c.rect(x, top_y, 1.8*mm, bh, stroke=0, fill=1)
            c.setFillColor(INK); c.setFont('AvenirMedium', 7.6)
            c.drawString(x+3.5*mm, top_y+bh-5*mm, title)
            c.setFillColor(MUTED); c.setFont('Avenir', 6.6)
            c.drawString(x+3.5*mm, top_y+2.5*mm, sub)
            if i<n-1:
                c.setStrokeColor(ACCENT); c.setLineWidth(1.2)
                ax1=x+bw; ax2=x+bw+arrow_gap; ay=top_y+bh/2
                c.line(ax1,ay, ax2-2*mm,ay)
                c.line(ax2-2*mm,ay, ax2-4.5*mm,ay+2*mm); c.line(ax2-2*mm,ay, ax2-4.5*mm,ay-2*mm)
        # arrow ke hasil
        cx=W/2; c.setStrokeColor(ACCENT); c.setLineWidth(1.2)
        c.line(cx, top_y, cx, top_y-6*mm)
        c.line(cx, top_y-6*mm, cx-2*mm, top_y-4.2*mm); c.line(cx, top_y-6*mm, cx+2*mm, top_y-4.2*mm)
        # result box
        rw=110*mm; rx=cx-rw/2; ry=top_y-6*mm-14*mm
        c.setFillColor(CARD); c.setStrokeColor(ACCENT); c.setLineWidth(0.9)
        c.rect(rx, ry, rw, 14*mm, stroke=1, fill=1)
        c.setFillColor(ACCENT); c.rect(rx, ry, 1.8*mm, 14*mm, stroke=0, fill=1)
        c.setFillColor(INK); c.setFont('AvenirMedium', 8.2)
        c.drawString(rx+4*mm, ry+8*mm, self.result[0])
        c.setFillColor(MUTED); c.setFont('Avenir', 7)
        c.drawString(rx+4*mm, ry+3.5*mm, self.result[1])

def build():
    story = []

    # ===== COVER =====
    story.append(Spacer(1, 8*mm))
    mark = Table([['']], colWidths=[9*mm], rowHeights=[9*mm],
                 style=TableStyle([('BACKGROUND',(0,0),(0,0),ACCENT),
                                   ('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)]))
    mark.hAlign = 'LEFT'
    cover_left = [mark, Spacer(1, 22*mm),
                  Paragraph('Dokumen sistem', eyebrow), Spacer(1, 1*mm),
                  Paragraph('Sistem Absensi LT', ParagraphStyle('t1', fontName='Georgia', fontSize=24, leading=29, textColor=INK)),
                  Spacer(1, 1*mm),
                  Paragraph('MTsN 1 Kebumen', ParagraphStyle('t2', fontName='AvenirMedium', fontSize=11.5, leading=15, textColor=MUTED)),
                  Spacer(1, 8*mm),
                  Paragraph('2026 · React + Express + PostgreSQL', ParagraphStyle('t3', fontName='Avenir', fontSize=9, leading=13, textColor=FAINT))]
    cover_right = [Frame('00-login.png', '', width=CW*0.46)]
    story.append(split_cols(cover_left, cover_right, lw=0.50, gap=12*mm))
    story.append(PageBreak())

    # ===== Pengantar + 01 Masuk =====
    story.append(para('Absensi LT adalah aplikasi absensi digital untuk MTsN 1 Kebumen. Dokumen ini menjelaskan alur kerja sistem secara ringkas — dari halaman login, panel admin, hingga sisi guru — disertai contoh tampilannya. Bagian akhir merangkum keamanan dan cara penggunaan.', bodyj))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph('Peta Situs', h2)); story.append(Spacer(1, 2*mm))
    story.append(Sitemap())
    story.append(PageBreak())
    story.append(SectionHead('01', 'Masuk', 'Login dan peran pengguna'))
    story.append(Spacer(1, 5*mm))
    story.append(split_cols([
        para('Satu halaman login (username + password). Sistem membaca peran, lalu mengarahkan: <b>Admin</b> ke Dashboard Admin, <b>Guru</b> ke Dashboard Guru.', bodyj),
        Spacer(1, 5*mm),
        para('<b>Keamanan</b>', h3), Spacer(1, 2*mm),
        para('Password di-hash (bcrypt); percobaan login yang salah dibatasi (anti brute-force).', body),
    ], [Frame('00-login.png', 'Halaman login', width=CW*0.56)]))
    story.append(PageBreak())

    # ===== 02 Sisi Admin =====
    story.append(SectionHead('02', 'Sisi Admin', 'Enam halaman kendali penuh'))
    story.append(Spacer(1, 5*mm))
    admin = [
        ('Dashboard', 'Monitoring kehadiran, tren 7 hari, dan guru yang belum input.', '10-admin-dashboard.png'),
        ('Manajemen Guru', 'CRUD guru, atur peran, aktif/nonaktif, reset password, hapus.', '11-admin-guru.png'),
        ('Data Absensi', 'Filter per bulan/tahun/guru, ekspor Excel, edit/hapus.', '12-admin-absensi.png'),
        ('Kelas & Shift', 'Keduanya dinamis — dikelola admin, dipakai di form absensi.', '13-admin-kelas-shift.png'),
        ('Audit Log', 'Jejak aktivitas: siapa, aksi, objek, waktu, dan IP.', '14-admin-audit.png'),
        ('Profil', 'Ganti password sendiri, ubah data, ubah foto profil.', '15-admin-profil.png'),
    ]
    rows = [[[para(t, h3), Spacer(1, 1*mm), para(d, sub)],
             [Frame(img, '', width=CW*0.56)]]
            for t, d, img in admin]
    tbl = Table(rows, colWidths=[CW*0.40, CW*0.60])
    tbl.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),
                             ('LEFTPADDING',(0,0),(-1,-1),0), ('RIGHTPADDING',(0,0),(-1,-1),0),
                             ('TOPPADDING',(0,0),(-1,-1),5), ('BOTTOMPADDING',(0,0),(-1,-1),5),
                             ('RIGHTPADDING',(0,0),(0,-1),10*mm), ('LEFTPADDING',(1,0),(1,-1),10*mm)]))
    story.append(tbl)
    story.append(PageBreak())

    # ===== 03 Sisi Guru =====
    story.append(SectionHead('03', 'Sisi Guru', 'Empat halaman untuk pengguna harian'))
    story.append(Spacer(1, 5*mm))
    guru = [
        ('Dashboard', 'Ringkasan kehadiran pribadi.', '20-guru-dashboard.png'),
        ('Absensi', 'Tanggal terkunci hari ini, shift & kelas dinamis, upload foto, catatan.', '21-guru-absensi.png'),
        ('Histori', 'Riwayat absensi per bulan, dapat difilter.', '22-guru-histori.png'),
        ('Profil', 'Ubah data diri, foto profil, ganti password.', '23-guru-profil.png'),
    ]
    rows = [[[para(t, h3), Spacer(1, 1*mm), para(d, sub)],
             [Frame(img, '', width=CW*0.56)]]
            for t, d, img in guru]
    tbl = Table(rows, colWidths=[CW*0.40, CW*0.60])
    tbl.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),
                             ('LEFTPADDING',(0,0),(-1,-1),0), ('RIGHTPADDING',(0,0),(-1,-1),0),
                             ('TOPPADDING',(0,0),(-1,-1),5), ('BOTTOMPADDING',(0,0),(-1,-1),5),
                             ('RIGHTPADDING',(0,0),(0,-1),10*mm), ('LEFTPADDING',(1,0),(1,-1),10*mm)]))
    story.append(tbl)
    story.append(PageBreak())

    # ===== 05 Perbandingan =====
    story.append(SectionHead('04', 'Perbandingan Peran', 'Admin dan guru'))
    story.append(Spacer(1, 5*mm))
    story.append(make_table(['Fitur', 'Admin', 'Guru'],
                   [['Dashboard monitoring seluruh guru', 'Ya', '—'],
                    ['Dashboard pribadi', 'Ya', 'Ya'],
                    ['Input absensi harian', '—', 'Ya'],
                    ['Histori pribadi', 'Ya', 'Ya'],
                    ['Kelola semua guru (CRUD, role, reset)', 'Ya', '—'],
                    ['Kelola kelas & shift', 'Ya', '—'],
                    ['Lihat & kelola data absensi semua', 'Ya', '—'],
                    ['Audit log', 'Ya', '—'],
                    ['Profil & ganti password sendiri', 'Ya', 'Ya']],
                   [112*mm, 28*mm, 28*mm]))
    story.append(PageBreak())

    # ===== 06 Perilaku / 07 Data =====
    story.append(SectionHead('05', 'Perilaku Penting', 'Aturan kunci yang menjaga integritas data'))
    story.append(Spacer(1, 5*mm))
    story.append(make_table(['Aturan', 'Penjelasan'],
                   [['Anti-manipulasi tanggal', 'Absensi hanya bisa diisi <b>hari ini</b>, berdasar waktu server (bukan perangkat).'],
                    ['Kelas & shift dinamis', 'Diambil dari basis data (dikelola admin), bukan nilai hardcoded.'],
                    ['Parameterized query', 'Semua query memakai placeholder — tahan SQL injection.'],
                    ['Audit log', 'Merekam aktivitas penting untuk transparansi.']],
                   [52*mm, 112*mm]))
    story.append(Spacer(1, 8*mm))
    story.append(SectionHead('06', 'Data & Cara Menambahkan', 'Sumber data di PostgreSQL'))
    story.append(Spacer(1, 5*mm))
    story.append(make_table(['Data', 'Siapa', 'Lewat apa'],
                   [['Guru (akun)', 'Admin', 'Manajemen Guru -> Tambah Guru'],
                    ['Absensi harian', 'Guru', 'Halaman Absensi (form, tiap hari)'],
                    ['Kelas', 'Admin', 'Kelola Kelas & Shift -> tab Kelas'],
                    ['Shift', 'Admin', 'Kelola Kelas & Shift -> tab Shift'],
                    ['Admin awal', 'Script', 'node server/setup-db.js (dari env)'],
                    ['Data demo', 'Script', 'node server/seed-demo.js']],
                   [48*mm, 24*mm, 84*mm]))
    story.append(Spacer(1, 6*mm))
    story.append(para('Enam tabel: <b>users</b>, <b>absensi</b>, <b>kelas</b>, <b>shift</b>, <b>audit_log</b>, <b>password_resets</b>. Ekspor lewat UI (Excel). Belum ada import massal — data masuk per-akun via form atau seed script.', small))
    story.append(PageBreak())

    # ===== 08 Keamanan =====
    story.append(SectionHead('07', 'Keamanan', 'Bagaimana sistem mengamankan data'))
    story.append(Spacer(1, 5*mm))
    story.append(make_table(['Lapis', 'Mekanisme'],
                   [['Password', 'Di-hash (bcrypt) — tidak disimpan polos'],
                    ['Login / OTP', 'Login username + password; reset via kode OTP email'],
                    ['Autorisasi', 'JWT + middleware yang re-verifikasi role & status dari DB tiap request'],
                    ['Rate-limit', 'Login/forgot/OTP dibatasi percobaan gagal (produksi)'],
                    ['SQL Injection', 'Semua query terparameterisasi (placeholder $1, $2)'],
                    ['Validasi input', 'express-validator; tanggal absensi = hari ini (server time)'],
                    ['Upload', 'Whitelist tipe (JPG/PNG/GIF/WebP/PDF) + 5MB + nosniff'],
                    ['CORS', 'Produksi hanya origin frontend (CLIENT_URL)'],
                    ['Security headers', 'CSP, X-Frame-Options, nosniff, HSTS'],
                    ['Rahasia', '.env di-gitignore; default admin dihapus (env-driven)'],
                    ['Audit', 'Audit Log merekam aktivitas + IP'],
                    ['Anti-manipulasi', 'Tanggal dikunci hari ini (server clock); kelas/shift bukan hardcode']],
                   [34*mm, 122*mm]))
    story.append(PageBreak())

    # ===== 09 Cara Pakai =====
    story.append(SectionHead('08', 'Cara Menggunakan Web', 'Panduan singkat'))
    story.append(Spacer(1, 5*mm))
    story.append(para('Masuk', h3)); story.append(Spacer(1, 2*mm))
    story.extend([Paragraph('•  Buka URL -> halaman Login.', li),
                  Paragraph('•  Isi username + password -> Masuk; otomatis ke Dashboard sesuai peran.', li),
                  Paragraph('•  Lupa password: Lupa Password -> email -> kode OTP -> password baru.', li)])
    story.append(Spacer(1, 5*mm))
    story.append(para('Operasional', h3)); story.append(Spacer(1, 2*mm))
    story.extend([Paragraph('•  Setiap fitur dijelaskan pada bagian <b>Sisi Admin</b> dan <b>Sisi Guru</b>, disertai contoh tampilannya.', li),
                  Paragraph('•  Pilih menu di sidebar untuk membuka halaman yang diinginkan.', li)])
    story.append(Spacer(1, 5*mm))
    story.append(para('Tips', h3)); story.append(Spacer(1, 2*mm))
    story.extend([Paragraph('•  Tanggal absensi hanya berlaku hari itu.', li),
                  Paragraph('•  Foto kegiatan maks 5MB (JPG/PNG/GIF/WebP).', li)])

    # ===== 09 Anotasi Form Absensi =====
    story.append(PageBreak())
    story.append(SectionHead('09', 'Anotasi Form Absensi', 'Nomor merah = urutan pengisian'))
    story.append(Spacer(1, 5*mm))
    from PIL import Image as _PI
    _ai=_PI.open(os.path.join(SHOT,'21-guru-absensi-annotated.png'))
    _aw=CW*0.62; _ah=_aw*_ai.size[1]/_ai.size[0]
    from reportlab.platypus import Image as _Img
    story.append(split_cols([
        para('Bagan di kiri memperlihatkan urutan pengisian absensi harian. Field <b>tanggal</b> terkunci otomatis (anti-manipulasi), shift & kelas diambil dari data dinamis yang dikelola admin.', bodyj),
        Spacer(1, 4*mm),
        para('Keterangan:', h3), Spacer(1, 2*mm),
    ] + [Paragraph(f'<b>{n}.</b>  {t}', li) for n,t in [
        (1,'Tanggal otomatis, terkunci hari ini'),
        (2,'Shift (dari data admin)'),
        (3,'Kelas (dari data admin)'),
        (4,'Status kehadiran'),
        (5,'Unggah foto kegiatan'),
        (6,'Catatan tambahan'),
        (7,'Tombol Kirim Absensi')]],
    [ _Img(os.path.join(SHOT,'21-guru-absensi-annotated.png'), width=_aw, height=_ah) ], lw=0.38))
    story.append(PageBreak())

    # ===== 10 Alur Input Absensi =====
    story.append(SectionHead('10', 'Alur Input Absensi', 'Dari tambah sampai data tercatat'))
    story.append(Spacer(1, 6*mm))
    story.append(FlowDiagram([('Buka Menu Absensi','guru pilih menu Absensi'),
                              ('Isi Form','tanggal auto · shift · kelas · status'),
                              ('Unggah Foto','opsional, maks 5MB'),
                              ('Kirim Absensi','klik tombol Kirim')],
                             ('Tercatat','Histori guru + Data Absensi admin')))
    story.append(Spacer(1, 4*mm))
    story.append(para('Hasil tersimpan ke database lalu muncul di <b>Histori</b> guru dan <b>Data Absensi</b> admin.', sub))
    story.append(Spacer(1, 4*mm))
    story.append(para('Dokumen ini dibuat dari aplikasi versi lokal (dev). Screenshot: light mode.', small))

    doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=24*mm, bottomMargin=22*mm,
                            title='Sistem Absensi LT — MTsN 1 Kebumen', author='Hermes Agent')
    doc.build(story, onFirstPage=cover_bg, onLaterPages=page_bg)
    print('PDF selesai:', OUT)

if __name__ == '__main__':
    build()
