import csv
import io
import re
import logging
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AdvancedTimetableParser:
    def __init__(self):
        self.department_pattern = re.compile(r'^([A-Z][A-Za-z\s&/()\-\']{2,120})\s*(?:-\s*)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b', re.IGNORECASE)
        self.time_slot_pattern = re.compile(r'(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})')
        self.capacity_pattern = re.compile(r'S\.?C\.?\s*:\s*(\d+)', re.IGNORECASE)
        self.sap_room_pattern = re.compile(r'([A-Z]-[A-Z0-9\-]+)')

        self.course_code_patterns = [
            re.compile(r'\b([A-Z]+)\s*[-]?\s*(\d{3,5})\s*/\s*([A-Z]+)?\s*(\d{3,5})\b'),
            re.compile(r'\(([A-Z]+)\s*(\d{3,5})\s*/\s*([A-Z]+)?\s*(\d{3,5})\)'),
            re.compile(r'\b([A-Z]+)\.(\d{3,5})(?:\|\d{1,2})?\b'),
            re.compile(r'\b([A-Z]+)\s*[-]?\s*(\d{3,5})(?:/\d{1,2})?\b'),
            re.compile(r'\(([A-Z]+)\s*(\d{3,5})(?:/\d{1,2})?\)'),
            re.compile(r'\(([A-Z]+)(\d{3,5})(?:/\d{1,2})?\)'),
            re.compile(r'\b([A-Z]+)\s*[-]\s*(\d{3,5})\b'),
            re.compile(r'\b([A-Z][A-Z0-9]{1,})\s*[\.-]+\s*(\d{3,5})(?:\|\d{1,2})?\b'),
            re.compile(r'\b([A-Z][A-Z0-9]{1,})\s*[-]?\s*(\d{3,5})(?:/\d{1,2})?\b'),
            re.compile(r'\(([A-Z][A-Z0-9]{1,})\s*[-]?\s*(\d{3,5})(?:/\d{1,2})?\)'),
            re.compile(r'\(([A-Z][A-Z0-9]{1,})(\d{3,5})(?:/\d{1,2})?\)'),
            re.compile(r'\b([A-Z]{2,})(\d{3,5})(?=\D|$)'),
        ]

        self.program_patterns = [
            re.compile(r'(BSCS|BSSE|BSAI)\s*[-\/]?\s*([IVX]+|\d+)\s*(?:-?\s*([A-Z]))?(?![a-z])'),
            re.compile(r'(BSCS)[-]?(\d+)([A-Z])(?![a-z])'),
            re.compile(r'(BSSE)[-]?(\d+)([A-Z])(?![a-z])'),
            re.compile(r'(BSAI)[-]?(\d+)([A-Z])(?![a-z])'),

            re.compile(r'(BSCS)[-]?(\d+)(?![A-Za-z])'),
            re.compile(r'(BSSE)[-]?(\d+)(?![A-Za-z])'),
            re.compile(r'(BSAI)[-]?(\d+)(?![A-Za-z])'),

            re.compile(r'(Pharm-?D)\s+([IVX]+)\s*(?:-\s*([A-Z]))?'),
            re.compile(r'(PharmD)\s+([IVX]+)(?![A-Za-z])'),

            re.compile(r'(BBA)[-]?([IVX]+)([A-Z]?)(?![a-z])'),
            re.compile(r'(BBA2Y)[-]?([IVX]+)([A-Z]?)(?![a-z])'),
            re.compile(r'(BBA2Y)[-]?(\d+)([A-Z]?)(?![a-z])'),
            re.compile(r'(BSAF)[-]?([IVX]+)([A-Z]?)(?![a-z])'),
            re.compile(r'(BSAF2Y)[-]?([IVX]+)([A-Z]?)(?![a-z])'),
            re.compile(r'(BSAF2Y)[-]?(\d+)([A-Z]?)(?![a-z])'),
            re.compile(r'(BSDM)[-]?([IVX]+)([A-Z]?)(?![a-z])'),
            re.compile(r'(BSFT)[-]?([IVX]+)([A-Z]?)(?![a-z])'),

            re.compile(r'(BS)\s+(\d+)([A-Z]?)(?![a-z])'),
            re.compile(r'(BS)[-]?([IVX]+)([A-Z]?)(?![a-z])'),
            re.compile(r'(BS)\s*[-]?\s*([IVX]+)\s*([A-Z]?)(?![a-z])'),
            re.compile(r'(B\.?S)\s*[-]?\s*([IVX]+|\d+)\s*([A-Z]?)(?![a-z])', re.IGNORECASE),
            re.compile(r'\b(DPT)\b[-]?([IVX]+)([A-Z]?)(?![a-z])'),
            re.compile(r'\b(RIT)\b[-]?([IVX]+)([A-Z]?)(?![a-z])'),
            re.compile(r'\b(HND)\b[-]?([IVX]+)([A-Z]?)(?![a-z])'),
            re.compile(r'\b(MLT)\b[-]?([IVX]+)([A-Z]?)(?![a-z])'),
            re.compile(r'\b(RIT)\b[-]?(\d+(?:ST|ND|RD|TH)?)([A-Z]?)(?![a-z])', re.IGNORECASE),
            re.compile(r'\b(HND)\b[-]?(\d+(?:ST|ND|RD|TH)?)([A-Z]?)(?![a-z])', re.IGNORECASE),
            re.compile(r'\b(MLT)\b[-]?(\d+(?:ST|ND|RD|TH)?)([A-Z]?)(?![a-z])', re.IGNORECASE),
            re.compile(r'(BS)\s+(Biotech|Biotechnology|Zoology|Urdu|English|ENG|Mathematics|Math|MATH|MATHS|Physics|Psychology|Criminology|Chemistry|Mathematics\s+For\s+Data\s+Science|Nursing|IR|SISS|SSISS)\b\s*(?:[-/]?\s*([IVX]+|\d+))?\s*(?:-\s*([A-Z]))?', re.IGNORECASE),
            re.compile(r'(B\.?Ed(?:u)?)\s*[-/]?\s*([IVX]+|\d+)\b', re.IGNORECASE),
            re.compile(r'(BS)\s+(\d+)\s*([A-Z])\b'),
        ]

        self.teacher_patterns = [
            re.compile(r'\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z][A-Za-z\s\.]*[A-Za-z]).*?SAP\s*ID\s*[:#-]?\s*(\d{4,6})\b', re.IGNORECASE),
            re.compile(r'\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z][A-Za-z\s\.]*[A-Za-z]).*?[\/]\s*(\d{4,6})\b', re.IGNORECASE),
            re.compile(r'\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*(\d{4,6})\b', re.IGNORECASE),
            re.compile(r'\b([A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*\((?:SAP\s*)?(\d{4,6})\)\s*(?=\s*(?:Room\b|$))', re.IGNORECASE),
            re.compile(r'\b([A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*(\d{4,6})\s*(?=\s*(?:Room\b|$))', re.IGNORECASE),
            re.compile(r'\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z][A-Za-z\s\.]*[A-Za-z])\b(?=\s*(?:Room\b|$))', re.IGNORECASE),
            re.compile(r'\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z\s\.]+[A-Za-z])\s*(\d{4,6})\s*$', re.IGNORECASE),
            re.compile(r'\b([A-Za-z][A-Za-z\s\.]+[A-Za-z])\s*\((\d{4,6})\)\s*$', re.IGNORECASE),
            re.compile(r'\b([A-Za-z][A-Za-z\s\.]+[A-Za-z])\s*(\d{4,6})\s*$', re.IGNORECASE),
            re.compile(r'\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z\s\.]+[A-Za-z])\s*$', re.IGNORECASE),
            re.compile(r'\b([A-Za-z][A-Za-z\s\.]{2,}[A-Za-z])\s*$', re.IGNORECASE),
            re.compile(r'\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]*[A-Za-z][A-Za-z\s\.]*[A-Za-z])\b', re.IGNORECASE),
        ]

        self.roman_numerals = {
            'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
            'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10'
        }

        self.reserved_patterns = [
            r'^\s*reserved\s*$',
            r'^\s*cs\s*reserved\s*$',
            r'^\s*math\s*reserved\s*$',
            r'^\s*dms\s*reserved\s*$',
            r'^\s*slot\s*used\s*$',
            r'.*\bslot\s*used\b.*',
            r'^\s*new\s*hiring\s*$',
            r'^\s*new\s*appointment\s*$',
            r'.*\bshifted\b.*',
            r'.*\bmoved\b.*',
            r'.*\bcancelled\b.*',
            r'.*\bcanceled\b.*',
            r'.*\bnew\s*hiring\b.*',
            r'.*\bnew\s*appointment\b.*',
        ]
        self.reserved_regex = re.compile('|'.join(self.reserved_patterns), re.IGNORECASE)
        self.allowed_departments = set()
        self.allowed_subdepts_by_dept = defaultdict(set)
        self._allowed_norm_subdepts = defaultdict(set)
        self.validation_log = []
        self.DEPT_SUBDEPT = {
            "CS & IT": {"Computer Science", "Software Engineering", "Artificial Intelligence", "CS & IT General"},
            "LAHORE BUSINESS SCHOOL": {"Business Administration", "Business Administration (2Y)", "Accounting & Finance", "Accounting & Finance (2Y)", "Digital Marketing", "Financial Technology", "Business General"},
            "ENGLISH": {"English", "English Literature", "English General"},
            "ZOOLOGY": {"Zoology", "Zoology General"},
            "CHEMISTRY": {"Chemistry", "Chemistry General"},
            "MATHEMATICS": {"Mathematics", "Mathematics General"},
            "PHYSICS": {"Physics", "Physics General"},
            "PSYCHOLOGY": {"Psychology", "Psychology General"},
            "BIO TECHNOLOGY": {"Biotechnology", "Biotechnology General"},
            "DPT": {"Doctor of Physical Therapy"},
            "Radiology and Imaging Technology/Medical Lab Technology": {"Radiology & Imaging Technology", "Medical Lab Technology", "Medical Technology General"},
            "Human Nutrition and Dietetics": {"Human Nutrition & Dietetics"},
            "School of Nursing": {"Nursing"},
            "PHARM-D": {"Pharmacy"},
            "EDUCATION": {"Education"},
            "SSISS": {"Social Sciences", "Criminology", "International Relations"},
            "URDU": {"Urdu", "Urdu Literature"},
            "ISLAMIC STUDY": {"Islamic Studies"}
        }
        self.SPEC_TO_DEPT = {
            'MATHEMATICS': 'MATHEMATICS',
            'MATH': 'MATHEMATICS',
            'MATHS': 'MATHEMATICS',
            'PHYSICS': 'PHYSICS',
            'CHEMISTRY': 'CHEMISTRY',
            'BIOTECH': 'BIO TECHNOLOGY',
            'BIOTECHNOLOGY': 'BIO TECHNOLOGY',
            'ZOOLOGY': 'ZOOLOGY',
            'ENGLISH': 'ENGLISH',
            'EDUCATION': 'EDUCATION',
            'PSYCHOLOGY': 'PSYCHOLOGY',
            'NURSING': 'School of Nursing',
            'URDU': 'URDU'
        }
        self.PROGRAM_TO_DEPT = {
            'BSCS': 'CS & IT',
            'BSSE': 'CS & IT',
            'BSAI': 'CS & IT',
            'PHARM-D': 'PHARM-D',
            'PHARMD': 'PHARM-D',
            'DPT': 'DPT',
            'RIT': 'Radiology and Imaging Technology/Medical Lab Technology',
            'MLT': 'Radiology and Imaging Technology/Medical Lab Technology',
            'HND': 'Human Nutrition and Dietetics',
            'BBA': 'LAHORE BUSINESS SCHOOL',
            'BBA2Y': 'LAHORE BUSINESS SCHOOL',
            'BSAF': 'LAHORE BUSINESS SCHOOL',
            'BSAF2Y': 'LAHORE BUSINESS SCHOOL',
            'BSDM': 'LAHORE BUSINESS SCHOOL',
            'BSFT': 'LAHORE BUSINESS SCHOOL'
        }

    def parse_csv_file(self, file_content: str) -> List[Dict[str, str]]:
        try:
            csv_reader = csv.reader(io.StringIO(file_content), skipinitialspace=True)
            rows = list(csv_reader)
            parsed_entries = []
            current_department = None
            current_day = None
            current_time_slots = []
            self.raw_grid = rows

            self._build_allowed_index(rows)

            i = 0
            while i < len(rows):
                row = rows[i]
                if not row or all(cell.strip() == '' for cell in row):
                    i += 1
                    continue

                dept_info = self.extract_department_info(row)
                if dept_info:
                    current_department, current_day = dept_info
                    current_time_slots = []
                    i += 1
                    continue

                if current_department and not current_time_slots:
                    time_slots = self.extract_time_slots(row)
                    if time_slots:
                        current_time_slots = time_slots
                        i += 1
                        continue

                if current_department and current_time_slots and len(row) > 0:
                    room_name = row[0].strip()
                    if re.search(r'Room\s*/\s*Labs', room_name, re.IGNORECASE):
                        i += 1
                        continue

                    room_capacity = self.extract_capacity(room_name)
                    sap_room_id = self.extract_sap_room_id(room_name)

                    entries = self.process_room_row_advanced(
                        row, i, current_department, current_day,
                        current_time_slots, room_name, room_capacity, sap_room_id
                    )
                    parsed_entries.extend(entries)

                i += 1

            final_entries = self.post_process_entries(parsed_entries)
            return final_entries
        except Exception as e:
            logger.error(f"Error parsing CSV file: {str(e)}")
            raise ValueError(f"CSV parsing failed: {str(e)}")

    def _norm(self, s: str) -> str:
        return re.sub(r'\s+', ' ', (s or '').strip().lower().replace('&', 'and'))

    def _build_allowed_index(self, rows: List[List[str]]):
        self.allowed_departments.clear()
        self.allowed_subdepts_by_dept.clear()
        self._allowed_norm_subdepts.clear()
        current_department = None
        for row in rows:
            dept_info = self.extract_department_info(row)
            if dept_info:
                current_department = dept_info[0]
                self.allowed_departments.add(current_department)
                continue
            if not current_department:
                continue
            for cell in row[1:]:
                if not cell:
                    continue
                text = ' '.join(line.strip() for line in str(cell).split('\n') if line.strip())
                globals_list = self._extract_global_programs(text)
                if globals_list:
                    for (p, s, sec) in globals_list:
                        if self._program_belongs_to_department(p, current_department):
                            sd = self.get_sub_department(current_department, p)
                            if sd and not ('general' in sd.lower() and not re.search(r'\bgeneral\b', text, flags=re.IGNORECASE)):
                                self.allowed_subdepts_by_dept[current_department].add(sd)
                                self._allowed_norm_subdepts[self._norm(current_department)].add(self._norm(sd))
                else:
                    if re.search(r'\bgeneral\b', text, flags=re.IGNORECASE):
                        cand = self.get_sub_department(current_department, '')
                        if cand and 'general' in cand.lower():
                            self.allowed_subdepts_by_dept[current_department].add(cand)
                            self._allowed_norm_subdepts[self._norm(current_department)].add(self._norm(cand))

    def _program_belongs_to_department(self, program: str, department: str) -> bool:
        p = (program or '').strip()
        d = self._normalize_department_name(department)
        if not p:
            return True
        pu = p.upper()
        if pu == 'BS':
            return True
        if pu.startswith('BS '):
            spec = pu[3:].strip()
            if not re.search(r'[A-Za-z]', spec):
                return True
            spec = {'ENG':'ENGLISH','EDU':'EDUCATION','MATH':'MATHEMATICS','MATHS':'MATHEMATICS'}.get(spec, spec)
            owner = self.SPEC_TO_DEPT.get(spec, None)
            return owner == d
        owner = self.PROGRAM_TO_DEPT.get(pu, None)
        return owner == d

    def _validate_subdept(self, department: str, subdept: str, program: str) -> str:
        if not subdept:
            return ''
        key = self._norm(self._normalize_department_name(department))
        sdn = self._norm(subdept)
        if sdn.endswith('general') and sdn not in self._allowed_norm_subdepts.get(key, set()):
            logger.warning(f"Rejected general sub_department '{subdept}' for department '{department}'")
            self.validation_log.append({'department': department, 'program': program, 'reason': 'general_not_allowed'})
            return ''
        if key in self._allowed_norm_subdepts and sdn not in self._allowed_norm_subdepts[key]:
            logger.warning(f"Rejected sub_department '{subdept}' for department '{department}' not present in CSV")
            self.validation_log.append({'department': department, 'program': program, 'reason': 'subdept_not_in_csv'})
            return ''
        return subdept

    def process_room_row_advanced(self, row: List[str], row_index: int, department: str, day: str,
                                  time_slots: List[str], room_name: str, room_capacity: str,
                                  sap_room_id: str) -> List[Dict[str, str]]:
        entries = []
        has_room_header = self.is_valid_room_header(room_name)
        if not has_room_header:
            room_name = "Unknown/TBD"
        for col_idx in range(1, min(len(row), len(time_slots) + 1)):
            if col_idx >= len(row):
                break
            cell_content = row[col_idx].strip()
            if not cell_content:
                continue
            extended_content = self.get_extended_cell_content(row_index, col_idx, cell_content)
            class_entries = self.parse_class_entry_comprehensive(
                extended_content, department, day, time_slots[col_idx - 1],
                room_name, room_capacity, sap_room_id, has_room_header
            )
            entries.extend(class_entries)
        return entries

    def get_extended_cell_content(self, row_index: int, col_index: int, base_content: str) -> str:
        return base_content

    def parse_class_entry_comprehensive(self, cell_content: str, department: str, day: str,
                                        time_slot: str, room_name: str, room_capacity: str,
                                        sap_room_id: str, has_room_header: bool = True) -> List[Dict[str, str]]:
        if not cell_content:
            return []
        if self.is_reserved_cell(cell_content):
            content = ' '.join(line.strip() for line in cell_content.split('\n') if line.strip())
            content = self.normalize_text_for_raw(content)
            return [self.create_class_entry(content, department, day, time_slot,
                                            room_name, room_capacity, sap_room_id,
                                            '', '', '', has_room_header=has_room_header)]
        content = ' '.join(line.strip() for line in cell_content.split('\n') if line.strip())
        content = self.normalize_text_for_raw(content)
        if re.fullmatch(r'\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*', content):
            return []
        subj0, _ = self.extract_subject_and_course_code(content)
        if self._is_program_metadata_segment(content, subj0):
            return []
        globals_list_early = self._extract_global_programs(content)
        if globals_list_early and len(globals_list_early) > 1:
            subj_preview, _cc_preview = self.extract_subject_and_course_code(content)
            if not self._is_program_metadata_segment(content, subj_preview):
                dept_norm = self._normalize_department_name(department)
                owned = [t for t in globals_list_early if self._program_belongs_to_department(t[0], dept_norm)]
                chosen_list = owned if owned else globals_list_early
                out = []
                seen = set()
                for (pp, ss, sc) in chosen_list:
                    key = (pp or '', str(ss or ''), sc or '')
                    if key in seen:
                        continue
                    seen.add(key)
                    e = self.create_class_entry(
                        content, department, day, time_slot,
                        room_name, room_capacity, sap_room_id,
                        pp, ss, sc, has_room_header=has_room_header
                    )
                    e['is_merged_class'] = 'true'
                    e['merged_programs'] = [
                        {
                            'program': p,
                            'semester': s,
                            'section': sec
                        } for (p, s, sec) in globals_list_early
                    ]
                    out.append(e)
                return out

        multi_pairs = list(re.finditer(r"\s*([^()]+?)\s*\(\s*((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)+\s+(?:[A-Z][a-z]+|[A-Z]\.)+(?:\s+(?:[A-Z][a-z]+|[A-Z]\.)){0,3})\s*\)", content))
        if len(multi_pairs) >= 2:
            entries = []
            inferred_program = self.infer_program_from_context(department, content)
            for m in multi_pairs:
                subj_raw = m.group(1).strip()
                teacher_raw = m.group(2).strip()
                subj_clean = re.sub(r"\s*[,&/]+\s*$", "", subj_raw)
                cc_subject, cc_code = self.extract_subject_and_course_code(subj_clean)
                sem, sec = self.extract_semester_section_from_any(subj_clean)
                entry = self.create_class_entry_direct(
                    subject=cc_subject,
                    course_code=cc_code,
                    department=department,
                    day=day,
                    time_slot=time_slot,
                    room_name=room_name,
                    room_capacity=room_capacity,
                    sap_room_id=sap_room_id,
                    program=inferred_program,
                    semester=sem,
                    section=sec,
                    teacher_name=self._cleanup_name_tail(teacher_raw),
                    teacher_sap_id="",
                    raw_text=f"{subj_clean} ({teacher_raw})",
                    has_room_header=has_room_header
                )
                entries.append(entry)
            entries = self._assign_programs_to_entries(entries, content)
            return entries

        teacher_any = list(re.finditer(r"((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]+(?:[A-Z][a-z]+|[A-Z]\.)+(?:\s+(?:[A-Z][a-z]+|[A-Z]\.)){0,3})", content))
        if len(teacher_any) >= 2:
            entries = []
            start_prev = 0
            for idx, tm in enumerate(teacher_any):
                end = tm.end()
                post = content[end:]
                m_id = re.match(r"\s*\(?\s*(\d{4,6})\s*\)?", post)
                if m_id:
                    end += m_id.end(0)
                segment = content[start_prev:end].strip()
                segment = re.sub(r'^\s*,\s*', '', segment)
                subj, code = self.extract_subject_and_course_code(segment)
                if self._is_program_metadata_segment(segment, subj):
                    start_prev = end
                    continue
                prog = self.infer_program_from_context(department, segment)
                sem3, sec3 = self.extract_semester_section_from_any(segment)
                teacher_name = tm.group(1).strip()
                teacher_name = self._cap_teacher_tokens(self._cleanup_name_tail(teacher_name))
                entry = self.create_class_entry_direct(
                    subject=subj,
                    course_code=code,
                    department=department,
                    day=day,
                    time_slot=time_slot,
                    room_name=room_name,
                    room_capacity=room_capacity,
                    sap_room_id=sap_room_id,
                    program=prog,
                    semester=sem3,
                    section=sec3,
                    teacher_name=teacher_name,
                    teacher_sap_id=m_id.group(1) if m_id else "",
                    raw_text=segment,
                    has_room_header=has_room_header
                )
                entries.append(entry)
                start_prev = end
            entries = self._assign_programs_to_entries(entries, content)
            return entries

        code_pairs = list(re.finditer(r"([^()]+?)\(([A-Za-z][^)]*?\d[^)]*?)\)", content))
        if len(code_pairs) >= 2:
            entries = []
            for idx, m in enumerate(code_pairs):
                start = m.start()
                end = code_pairs[idx + 1].start() if idx + 1 < len(code_pairs) else len(content)
                segment = content[start:end].strip()
                segment = re.sub(r'^\s*,\s*', '', segment)
                segment = self.normalize_text_for_raw(segment)
                program, semester, section = "", "", ""
                for pattern in self.program_patterns:
                    ms = pattern.search(segment)
                    if ms:
                        program = ms.group(1)
                        if program.lower() == 'bs' and len(ms.groups()) >= 3 and isinstance(ms.group(2), str):
                            spec = ms.group(2).strip()
                            semester_raw = ms.group(3) if len(ms.groups()) > 2 else ""
                            section = ms.group(4) if len(ms.groups()) > 3 else ""
                            program = f"BS {spec.title()}"
                        else:
                            semester_raw = ms.group(2)
                            section = ms.group(3) if len(ms.groups()) > 2 else ""
                        semester = self.convert_roman_to_numeric(semester_raw) if isinstance(semester_raw, str) and semester_raw.isalpha() else semester_raw
                        break
                if not program:
                    program = self.infer_program_from_context(department, segment)
                    sem2, sec2 = self.extract_semester_section_from_any(segment)
                    if sem2:
                        semester = sem2
                    if sec2:
                        section = sec2
                subj_preview, _cc_preview = self.extract_subject_and_course_code(segment)
                if self._is_program_metadata_segment(segment, subj_preview):
                    continue
                gl = self._extract_global_programs(segment)
                if gl and len(gl) > 1:
                    for (p_g, s_g, sec_g) in gl:
                        entries.append(self.create_class_entry(
                            segment,
                            department,
                            day,
                            time_slot,
                            room_name,
                            room_capacity,
                            sap_room_id,
                            p_g,
                            s_g,
                            sec_g,
                            has_room_header=has_room_header
                        ))
                else:
                    entry = self.create_class_entry(
                        segment,
                        department,
                        day,
                        time_slot,
                        room_name,
                        room_capacity,
                        sap_room_id,
                        program,
                        semester,
                        section,
                        has_room_header=has_room_header
                    )
                    entries.append(entry)
            t_any = list(re.finditer(r"((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]*+(?:[A-Z][a-z]+|[A-Z]\.)+(?:\s+(?:[A-Z][a-z]+|[A-Z]\.)){0,3})", content))
            if len(t_any) >= 1:
                tname = self._cap_teacher_tokens(self._cleanup_name_tail(t_any[0].group(1).strip()))
                for e in entries:
                    if not e.get('teacher_name'):
                        e['teacher_name'] = tname
            elif len(entries) >= 2:
                tname2, _sap2 = self.extract_teacher_info(content)
                if tname2:
                    tname2 = self._cleanup_name_tail(tname2)
                    for e in entries:
                        if not e.get('teacher_name'):
                            e['teacher_name'] = tname2
            entries = self._assign_programs_to_entries(entries, content)
            return entries


        all_program_matches: List[Tuple[str, str, str]] = []
        for pattern in self.program_patterns:
            matches = pattern.findall(content)
            for match in matches:
                if isinstance(match, tuple) and len(match) >= 2:
                    program = match[0]
                    if program.lower() == 'bs' and len(match) >= 3 and isinstance(match[1], str):
                        spec = match[1].strip()
                        sem_raw = match[2] if len(match) > 2 else ""
                        sec = match[3] if len(match) > 3 else ""
                        semester = self.convert_roman_to_numeric(sem_raw) if sem_raw and isinstance(sem_raw, str) and sem_raw.isalpha() else (sem_raw or '')
                        prog_name = f"BS {spec.title()}"
                        all_program_matches.append((prog_name, semester, sec))
                        continue
                    semester_raw = match[1]
                    section = match[2] if len(match) > 2 else ""
                    semester = self.convert_roman_to_numeric(semester_raw) if isinstance(semester_raw, str) and semester_raw.isalpha() else semester_raw
                    all_program_matches.append((program, semester, section))

        inferred_program = self.infer_program_from_context(department, content)
        sem, sec = self.extract_semester_section_from_any(content)
        globals_list = self._extract_global_programs(content)
        if globals_list:
            if len(globals_list) > 1:
                subj_preview, _cc_preview = self.extract_subject_and_course_code(content)
                if not self._is_program_metadata_segment(content, subj_preview):
                    dept_norm = self._normalize_department_name(department)
                    owned = [t for t in globals_list if self._program_belongs_to_department(t[0], dept_norm)]
                    chosen_list2 = owned if owned else globals_list
                    out2 = []
                    seen2 = set()
                    for (pp2, ss2, sc2) in chosen_list2:
                        key2 = (pp2 or '', str(ss2 or ''), sc2 or '')
                        if key2 in seen2:
                            continue
                        seen2.add(key2)
                        e2 = self.create_class_entry(
                            content, department, day, time_slot,
                            room_name, room_capacity, sap_room_id,
                            pp2, ss2, sc2
                        )
                        e2['is_merged_class'] = 'true'
                        e2['merged_programs'] = [
                            {
                                'program': p,
                                'semester': s,
                                'section': sec
                            } for (p, s, sec) in globals_list
                        ]
                        out2.append(e2)
                    return out2
            else:
                chosen2 = next((t for t in globals_list if t[0].startswith('BS ') and t[0] != 'BS'), globals_list[0])
                program, semester, section = chosen2
                inferred_program = program or inferred_program
                sem = semester or sem
                sec = section or sec
        elif all_program_matches:
            program, semester, section = all_program_matches[0]
            inferred_program = program or inferred_program
            sem = semester or sem
            sec = section or sec
        return [self.create_class_entry(content, department, day, time_slot,
                                        room_name, room_capacity, sap_room_id,
                                        inferred_program, sem, sec, has_room_header=has_room_header)]

    def normalize_text_for_raw(self, text: str) -> str:
        s = text
        s = re.sub(r'\bQuantitaive\b', 'Quantitative', s, flags=re.IGNORECASE)
        s = re.sub(r'\bDigitial\b', 'Digital', s, flags=re.IGNORECASE)
        return s

    def post_process_entries(self, entries: List[Dict[str, str]]) -> List[Dict[str, str]]:
        grouped_by_class = defaultdict(list)
        for entry in entries:
            key = (
                entry.get('department', ''),
                entry.get('program', ''),
                entry.get('semester', ''),
                entry.get('section', ''),
                entry.get('subject', ''),
                entry.get('course_code', ''),
                entry.get('room_name', ''),
                entry.get('teacher_name', ''),
                entry.get('day', '')
            )
            grouped_by_class[key].append(entry)

        lab_sessions = set()
        for key, class_entries in grouped_by_class.items():
            if len(class_entries) >= 3:
                class_entries.sort(key=lambda x: x.get('time_slot', ''))
                for i in range(len(class_entries) - 2):
                    slot1 = class_entries[i].get('time_slot', '')
                    slot2 = class_entries[i + 1].get('time_slot', '')
                    slot3 = class_entries[i + 2].get('time_slot', '')
                    if self.are_consecutive_slots(slot1, slot2) and self.are_consecutive_slots(slot2, slot3):
                        for j in range(i, i + 3):
                            entry_id = id(class_entries[j])
                            lab_sessions.add(entry_id)

        # Collapse merged classes across programs/sections for the same display key
        by_display = defaultdict(list)
        for entry in entries:
            subject = entry.get('subject', '')
            raw_text = entry.get('raw_text', '')
            if self._is_program_metadata_segment(raw_text or subject, subject):
                continue
            # Group across teacher/room differences to avoid duplicate cards
            display_key = (
                entry.get('department', ''),
                entry.get('day', ''),
                entry.get('time_slot', ''),
                entry.get('subject', ''),
                entry.get('course_code', '')
            )
            by_display[display_key].append(entry)

        final_entries = []
        for display_key, group in by_display.items():
            base = group[0].copy()
            if any(id(e) in lab_sessions for e in group):
                base['is_lab_session'] = 'true'
                base['lab_duration'] = '3_hours'
            rooms = [e.get('room_name','') for e in group if e.get('room_name')]
            known_rooms = [r for r in rooms if r and not re.search(r'Unknown/TBD', r, re.IGNORECASE)]
            if known_rooms:
                base['room_name'] = known_rooms[0]
            teachers = [(e.get('teacher_name','') or '', e.get('teacher_sap_id','') or '') for e in group]
            best_t = ''
            best_id = ''
            for (t, sid) in teachers:
                if t and sid:
                    best_t, best_id = t, sid
                    break
            if not best_t:
                for (t, sid) in teachers:
                    if t and not re.search(r'\bTBA\b', t, re.IGNORECASE):
                        best_t, best_id = t, sid
                        break
            if not best_t:
                for (t, sid) in teachers:
                    if t:
                        best_t, best_id = t, sid
                        break
            if best_t:
                base['teacher_name'] = best_t
                base['teacher_sap_id'] = best_id
            merged_list = []
            for e in group:
                p = e.get('program', '')
                s = e.get('semester', '')
                sec = e.get('section', '')
                if p or s or sec:
                    merged_list.append((p, str(s), sec))
            seen_mp = set()
            mp_raw = []
            for p,s,sec in merged_list:
                k = (p or '', s or '', sec or '')
                if k not in seen_mp:
                    seen_mp.add(k)
                    mp_raw.append(k)
            gl_all = self._extract_global_programs(base.get('raw_text','') or '')
            for (p,s,sec) in gl_all:
                k = ((p or ''), str(s or ''), (sec or ''))
                if k not in seen_mp:
                    seen_mp.add(k)
                    mp_raw.append(k)
            mp_info = []
            merged_depts = set()
            base_dep_norm = self._normalize_department_name(base.get('department','') or '')
            for (p,s,sec) in mp_raw:
                dep2 = self.PROGRAM_TO_DEPT.get((p or '').upper(), None)
                if dep2 is None and (p or '').upper().startswith('BS '):
                    spec = (p[3:] or '').strip().upper().replace('.', '')
                    spec = {'ENG':'ENGLISH','MATH':'MATHEMATICS','MATHS':'MATHEMATICS','EDU':'EDUCATION','URDU':'URDU'}.get(spec, spec)
                    dep2 = self.SPEC_TO_DEPT.get(spec, None)
                dep_final = dep2 or ''
                if dep_final:
                    merged_depts.add(dep_final)
                sd = self.get_sub_department(dep_final or base_dep_norm, p or '')
                sd = self._validate_subdept(dep_final or base_dep_norm, sd, p or '')
                mp_info.append({'program': p, 'semester': s, 'section': sec, 'department': dep_final, 'sub_department': sd})
            base['is_merged_class'] = 'true'
            base['merged_programs'] = mp_info
            if merged_depts:
                base['merged_departments'] = sorted(list(merged_depts))
            has_cross = any((d and self._normalize_department_name(d) != base_dep_norm) for d in merged_depts)
            base['has_cross_department_merge'] = 'true' if has_cross else 'false'
            final_entries.append(base)
        final_entries = self._annotate_csit_lab_sections(final_entries)
        seen_keys = set()
        deduped = []
        for e in final_entries:
            k = (
                self._norm(e.get('department','')),
                self._norm(e.get('sub_department','')),
                self._norm(e.get('program','')),
                str(e.get('semester','') or ''),
                self._norm(e.get('section','')),
                self._norm(e.get('subject','')),
                self._norm(e.get('course_code','')),
                self._norm(e.get('day','')),
                self._norm(e.get('time_slot','')),
                self._norm(e.get('room_name',''))
            )
            if k in seen_keys:
                continue
            seen_keys.add(k)
            deduped.append(e)
        return deduped

    def _annotate_csit_lab_sections(self, entries: List[Dict[str, str]]) -> List[Dict[str, str]]:
        from datetime import datetime
        ts = datetime.utcnow().isoformat() + 'Z'
        bykey = defaultdict(list)
        slots_by_day = defaultdict(set)
        for e in entries:
            if e.get('department') == 'CS & IT':
                k = (
                    e.get('day',''),
                    e.get('room_name',''),
                    e.get('teacher_name',''),
                    e.get('subject',''),
                    e.get('course_code','')
                )
                bykey[k].append(e)
                slots_by_day[e.get('day','')].add(e.get('time_slot',''))
        def next_slot(day: str, slot: str) -> str:
            for s in slots_by_day.get(day, set()):
                if self.are_consecutive_slots(slot, s):
                    return s
            return ''
        for k, group in bykey.items():
            group.sort(key=lambda x: x.get('time_slot',''))
            i = 0
            while i < len(group):
                j = i
                while j + 1 < len(group) and self.are_consecutive_slots(group[j].get('time_slot',''), group[j+1].get('time_slot','')):
                    j += 1
                span = j - i + 1
                if span >= 2:
                    span_slots = [group[t].get('time_slot','') for t in range(i, j+1)]
                    gid = f"{group[i].get('day','')}|{group[i].get('room_name','')}|{group[i].get('teacher_name','')}|{group[i].get('subject','')}|{group[i].get('course_code','')}|{group[i].get('time_slot','')}"
                    for t in range(i, j+1):
                        group[t]['is_lab_session'] = 'true'
                        group[t]['lab_duration'] = f"{span}_hours"
                        group[t]['lab_annotation_source'] = 'auto:csit-lab-detection/v1'
                        group[t]['lab_annotation_timestamp'] = ts
                        group[t]['lab_span_slots'] = span_slots
                        group[t]['lab_span_group_id'] = gid
                        group[t]['lab_span_is_start'] = 'true' if t == i else 'false'
                i = j + 1
        for e in entries:
            if e.get('department') == 'CS & IT' and e.get('is_lab_session') != 'true':
                raw = e.get('raw_text','')
                subj = e.get('subject','')
                if re.search(r'\bLAB\b', raw, flags=re.IGNORECASE) or re.search(r'\bLAB\b', subj, flags=re.IGNORECASE):
                    e['is_lab_session'] = 'true'
                    e['lab_duration'] = '3_hours'
                    e['lab_annotation_source'] = 'auto:csit-lab-detection/v1'
                    e['lab_annotation_timestamp'] = ts
                    s1 = e.get('time_slot','')
                    s2 = next_slot(e.get('day',''), s1)
                    s3 = next_slot(e.get('day',''), s2) if s2 else ''
                    span_slots = [s for s in [s1, s2, s3] if s]
                    e['lab_span_slots'] = span_slots
                    e['lab_span_group_id'] = f"{e.get('day','')}|{e.get('room_name','')}|{e.get('teacher_name','')}|{e.get('subject','')}|{e.get('course_code','')}|{s1}"
                    e['lab_span_is_start'] = 'true'
        return entries

    def are_consecutive_slots(self, slot1: str, slot2: str) -> bool:
        try:
            end1 = slot1.split('-')[1].strip()
            start2 = slot2.split('-')[0].strip()
            return end1 == start2
        except:
            return False

    def extract_department_info(self, row: List[str]) -> Optional[Tuple[str, str]]:
        if not row:
            return None
        first_cell = row[0].strip()
        match = self.department_pattern.match(first_cell)
        if match:
            department = match.group(1).strip()
            day = match.group(2).strip()
            department = re.sub(r'\s+', ' ', department)
            department = department.strip().strip('"\'')
            department = re.sub(r'\s*-\s*$', '', department)
            return department, day
        return None

    def extract_time_slots(self, row: List[str]) -> List[str]:
        time_slots = []
        for cell in row[1:]:
            if not cell:
                continue
            cell = cell.strip()
            if self.time_slot_pattern.search(cell):
                time_slots.append(cell)
        return time_slots

    def extract_capacity(self, room_text: str) -> str:
        match = self.capacity_pattern.search(room_text)
        return match.group(1) if match else ""

    def extract_sap_room_id(self, room_text: str) -> str:
        match = self.sap_room_pattern.search(room_text)
        return match.group(1) if match else ""

    def create_class_entry(self, content: str, department: str, day: str, time_slot: str,
                           room_name: str, room_capacity: str, sap_room_id: str,
                           program: str, semester: str, section: str, has_room_header: bool = True) -> Dict[str, str]:
        subject, course_code = self.extract_subject_and_course_code(content)
        teacher_name, teacher_sap_id = self.extract_teacher_info(content, section)
        inline_room = self.extract_inline_room(content)
        room_name = self.resolve_room_name(room_name, inline_room, has_room_header, content_text=content, department=department)
        room_name = re.sub(r'\s+', ' ', room_name).strip()
        program = re.sub(r'\bB\.?S\b', 'BS', program).strip()
        sub_department = self.get_sub_department(department, program)
        sub_department = self._validate_subdept(department, sub_department, program)
        return {
            'day': day,
            'department': department,
            'sub_department': sub_department,
            'time_slot': time_slot,
            'room_name': room_name,
            'subject': subject,
            'course_code': course_code,
            'program': program,
            'semester': semester,
            'section': section,
            'teacher_name': teacher_name,
            'teacher_sap_id': teacher_sap_id,
            'raw_text': content
        }

    def create_class_entry_direct(self, subject: str, course_code: str, department: str, day: str,
                                  time_slot: str, room_name: str, room_capacity: str,
                                  sap_room_id: str, program: str, semester: str, section: str,
                                  teacher_name: str, teacher_sap_id: str, raw_text: str,
                                  has_room_header: bool = True) -> Dict[str, str]:
        inline_room = self.extract_inline_room(raw_text)
        room_name = self.resolve_room_name(room_name, inline_room, has_room_header, content_text=raw_text, department=department)
        room_name = re.sub(r'\s+', ' ', room_name).strip()
        program = re.sub(r'\bB\.?S\b', 'BS', program).strip()
        sub_department = self.get_sub_department(department, program)
        sub_department = self._validate_subdept(department, sub_department, program)
        return {
            'day': day,
            'department': department,
            'sub_department': sub_department,
            'time_slot': time_slot,
            'room_name': room_name,
            'subject': subject,
            'course_code': course_code,
            'program': program,
            'semester': semester,
            'section': section,
            'teacher_name': teacher_name,
            'teacher_sap_id': teacher_sap_id,
            'raw_text': raw_text
        }

    def resolve_room_name(self, header_room: str, inline_room: str, has_room_header: bool, content_text: str = "", department: str = "") -> str:
        if has_room_header:
            header_ok = self.is_valid_room_header(header_room)
            out = header_room if header_ok else inline_room
            out = re.sub(r'Room#', 'Room ', out)
            out = re.sub(r'Lab#', 'Lab ', out)
            return out
        # If no header room, only trust inline room if it appears outside parentheses
        t = content_text or ""
        for pat, fmt in [
            (r'\bRoom\s*no\.?\s*(\d+)\b', 'Room {}'),
            (r'\bRoom\s*#\s*(\d+)\b', 'Room#{}'),
            (r'\bRoom\s*[#:]?\s*([A-Z0-9\-/]+)\b', 'Room {}'),
            (r'\bLab\s*#\s*(\d+)\b', 'Lab#{}'),
            (r'\bLab\s*[#:]?\s*([A-Z0-9\-/]+)\b', 'Lab {}'),
        ]:
            m = re.search(pat, t, flags=re.IGNORECASE)
            if m:
                idx = m.start()
                inside_paren = (t.count('(', 0, idx) > t.count(')', 0, idx))
                if not inside_paren or department.upper() in {'EDUCATION','PSYCHOLOGY','SSISS','SISS','BIO TECHNOLOGY','BIOTECH','BIOTECHNOLOGY','URDU'}:
                    out = fmt.format(m.group(1))
                    out = re.sub(r'Room#', 'Room ', out)
                    out = re.sub(r'Lab#', 'Lab ', out)
                    return out
        m5 = re.search(r'\(\s*(?:Room\s*)?(\d{2,4})\)\s*$', t, flags=re.IGNORECASE)
        if m5 and department.upper() in {'EDUCATION','PSYCHOLOGY','SSISS','SISS','BIO TECHNOLOGY','BIOTECH','BIOTECHNOLOGY','URDU'}:
            out = f"Room {m5.group(1)}"
            out = re.sub(r'Room#', 'Room ', out)
            out = re.sub(r'Lab#', 'Lab ', out)
            return out
        return (header_room and re.sub(r'#', ' ', header_room)) or "Unknown/TBD"

    def is_valid_room_header(self, room_text: str) -> bool:
        t = (room_text or '').strip()
        if not t:
            return False
        if self.capacity_pattern.search(t) or self.sap_room_pattern.search(t):
            return True
        if re.match(r'^\d{2,}\b', t):
            return True
        if re.search(r'\bLab\b', t, flags=re.IGNORECASE):
            return True
        return False

    def extract_inline_room(self, text: str) -> str:
        m = re.search(r'Room\s*#\s*(\d+)', text, flags=re.IGNORECASE)
        if m:
            return f"Room#{m.group(1)}"
        m0 = re.search(r'\bRoom\s*no\.?\s*(\d+)\b', text, flags=re.IGNORECASE)
        if m0:
            return f"Room {m0.group(1)}"
        m2 = re.search(r'\bRoom\s*[#:]?\s*([A-Z0-9\-/]+)', text, flags=re.IGNORECASE)
        if m2:
            return f"Room {m2.group(1)}"
        m3 = re.search(r'Lab\s*#\s*(\d+)', text, flags=re.IGNORECASE)
        if m3:
            return f"Lab#{m3.group(1)}"
        m4 = re.search(r'\bLab\s*[#:]?\s*([A-Z0-9\-/]+)', text, flags=re.IGNORECASE)
        if m4:
            return f"Lab {m4.group(1)}"
        return ""

    def get_sub_department(self, department: str, program: str) -> str:
        dnorm = self._normalize_department_name(department)
        p = (program or '').upper()
        if p.startswith('BS '):
            spec = p[3:].strip()
            if not re.search(r'[A-Za-z]', spec):
                # No alpha spec (likely level/roman). Fall back to dept-specific default
                pass
            else:
                syn = {
                    'MATHS': 'Mathematics',
                    'MATH': 'Mathematics',
                    'ENG': 'English',
                    'EDU': 'Education',
                    'SSISS': 'SISS'
                }
                spec2 = syn.get(spec.upper(), spec.title())
                return spec2 if spec2 in self.DEPT_SUBDEPT.get(dnorm, set()) else ''
        if p == "HND":
            return "Human Nutrition & Dietetics"
        if p == "RIT":
            return "Radiology & Imaging Technology"
        if p == "MLT":
            return "Medical Lab Technology"
        if p == "DPT":
            return "Doctor of Physical Therapy"
        if dnorm == "CS & IT":
            if program == "BSCS":
                return "Computer Science"
            elif program == "BSSE":
                return "Software Engineering"
            elif program == "BSAI":
                return "Artificial Intelligence"
            else:
                return "CS & IT General"
        elif dnorm == "LAHORE BUSINESS SCHOOL":
            if program == "BBA2Y":
                return "Business Administration (2Y)"
            if program == "BSAF2Y":
                return "Accounting & Finance (2Y)"
            if program == "BBA":
                return "Business Administration"
            elif program == "BSAF":
                return "Accounting & Finance"
            elif program == "BSDM":
                return "Digital Marketing"
            elif program == "BSFT":
                return "Financial Technology"
            else:
                return "Business General"
        elif dnorm == "ENGLISH":
            if program == "BS":
                return "English"
            else:
                return "English General"
        elif dnorm == "ZOOLOGY":
            if program.upper().startswith("BS"):
                return "Zoology"
            else:
                return "Zoology General"
        elif dnorm == "CHEMISTRY":
            if program.upper().startswith("BS"):
                return "Chemistry"
            else:
                return "Chemistry General"
        elif dnorm == "MATHEMATICS":
            if program.upper().startswith("BS"):
                return "Mathematics"
            else:
                return "Mathematics General"
        elif dnorm == "PHYSICS":
            if program.upper().startswith("BS"):
                return "Physics"
            else:
                return "Physics General"
        elif dnorm == "PSYCHOLOGY":
            if program.upper().startswith("BS"):
                return "Psychology"
            else:
                return "Psychology General"
        elif dnorm == "BIO TECHNOLOGY":
            if program.upper().startswith("BS"):
                return "Biotechnology"
            else:
                return "Biotechnology General"
        elif dnorm == "DPT":
            return "Doctor of Physical Therapy"
        elif dnorm == "Radiology and Imaging Technology/Medical Lab Technology":
            if program == "RIT":
                return "Radiology & Imaging Technology"
            elif program == "MLT":
                return "Medical Lab Technology"
            elif program == "HND":
                return "Human Nutrition & Dietetics"
            else:
                return "Medical Technology General"
        elif dnorm == "School of Nursing":
            return "Nursing"
        elif dnorm == "PHARM-D":
            return "Pharmacy"
        elif dnorm == "EDUCATION":
            return "Education"
        elif dnorm == "SSISS":
            return "Social Sciences"
        elif dnorm == "URDU":
            return "Urdu Literature"
        elif dnorm == "ISLAMIC STUDY":
            return "Islamic Studies"
        elif dnorm == "Human Nutrition and Dietetics":
            return "Human Nutrition & Dietetics"
        else:
            return dnorm

    def _normalize_department_name(self, name: str) -> str:
        n = name.strip()
        n = re.sub(r'^Human Nutrition and Dietetics\s*\([^)]+\)\s*$', 'Human Nutrition and Dietetics', n, flags=re.IGNORECASE)
        n = re.sub(r'\s+', ' ', n).strip()
        return n

    def extract_subject_and_course_code(self, text: str) -> Tuple[str, str]:
        course_code = ""
        subject = ""
        course_code_match = None
        clean = re.sub(r'\(([A-Z]{2,})\s*[-]{2,}\s*(\d{3,5})(?:\|\d+)?\)', r'(\1 \2)', text)
        clean = re.sub(r'\b([A-Z]{2,})\s*[-]{2,}\s*(\d{3,5})(?:\|\d+)?\b', r'\1 \2', clean)
        clean = re.sub(r'\(([A-Z]{2,})\s*[\-\s]*\s*(\d{3,5})(?:\|\d+)?\)', r'(\1 \2)', clean)
        clean = re.sub(r'\b([A-Z]{2,})(\d{3,5})\s*/\s*[A-Z]{2,}\d{3,5}\b', r'\1 \2', clean)
        clean = re.sub(r'\(([A-Z]{2,})(\d{3,5})\s*/\s*[A-Z]{2,}\d{3,5}\)', r'(\1 \2)', clean)
        text2 = clean
        if re.match(r'^\s*(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)(?:\b|\s)', text2):
            par = re.search(r'\(([^\)]{3,})\)', text2)
            if par:
                text2 = par.group(1).strip()
        ignore_prefixes = { 'ROOM', 'ROOM#', 'LAB', 'SAP' }
        for pattern in self.course_code_patterns:
            for m in pattern.finditer(text2):
                prefix = m.group(1)
                if prefix and prefix.upper() in ignore_prefixes:
                    continue
                course_code_match = m
                if len(m.groups()) == 4:
                    p1 = m.group(1)
                    n1 = m.group(2)
                    p2 = m.group(3) or p1
                    n2 = m.group(4)
                    course_code = f"{p1} {n1}/{p2}{n2}"
                else:
                    course_code = f"{m.group(1)} {m.group(2)}"
                break
            if course_code_match:
                break
        if course_code_match:
            subject = text2[:course_code_match.start()].strip()
            after_code = text2[course_code_match.end():]
            if re.search(r'\b[lL]ab\b', after_code):
                subject = (subject + ' Lab').strip()
        else:
            program_match = None
            for pattern in self.program_patterns:
                for match in pattern.finditer(text2):
                    if (program_match is None) or (match.start() < program_match.start()):
                        program_match = match
            if program_match:
                cut_at = program_match.start()
                paren_before = text2.rfind('(', 0, cut_at)
                if paren_before != -1 and paren_before < cut_at:
                    subject = text2[:paren_before].strip()
                else:
                    subject = text2[:cut_at].strip()
            else:
                bs_prog_like = re.search(r'\bBS\s+[A-Za-z][A-Za-z\s&]+\s*(?:[-/]?\s*[IVX]+|\s*\d+)?\b', text, flags=re.IGNORECASE)
                if bs_prog_like:
                    cut_at = bs_prog_like.start()
                    paren_before = text2.rfind('(', 0, cut_at)
                    if paren_before != -1 and paren_before < cut_at:
                        subject = text2[:paren_before].strip()
                    else:
                        subject = text2[:cut_at].strip()
                else:
                    tmatch = re.search(r'\b(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)(?:\b|\s)', text2)
                    if tmatch:
                        if tmatch.start() <= 2:
                            subject = text2[tmatch.end():].strip()
                        else:
                            subject = text2[:tmatch.start()].strip()
                    else:
                        subject = text2
        subject = re.sub(r'^\s*,\s*', '', subject)
        subject = re.sub(r'\bRoom\s*[#:]?\s*[A-Za-z0-9\-/]+', '', subject, flags=re.IGNORECASE)
        subject = re.sub(r'\bLab\s*[#:]?\s*[A-Za-z0-9\-/]+', '', subject, flags=re.IGNORECASE)
        subject = re.sub(r'\s*-\s*Lab\b.*$', '', subject, flags=re.IGNORECASE)
        subject = re.sub(r'[\/]{2,}', '/', subject)
        subject = re.sub(r'\s*\((?:[^)]*\b(?:BS|B\.?Ed|English|ENG|Maths|Mathematics|Urdu|Zoology|Psychology|SISS|SSISS|Nursing|BBA|BSAF|BSCS|BSSE|BSAI|BSMDS)\b[^)]*)\)\s*$', '', subject, flags=re.IGNORECASE)
        subject = re.sub(r'\s*\(?\s*Semester\s*#?\s*(?:[IVX]+|\d+(?:st|nd|rd|th)?)\s*\)?\s*$', '', subject, flags=re.IGNORECASE)
        subject = re.sub(r'\s*\b(?:\d{1,2}(?:st|nd|rd|th))\s*sem(?:ester|ster)\b\s*$', '', subject, flags=re.IGNORECASE)
        subject = re.sub(r'^[\(\),;\/\-\s]+', '', subject)
        subject = subject.rstrip('(').rstrip(',').rstrip('-').strip()
        subject = re.sub(r'\(\s*\)$', '', subject).strip()
        subject = re.sub(r'\s+', ' ', subject).strip()
        subject = re.sub(r'\blab\b', 'Lab', subject, flags=re.IGNORECASE)
        subject = re.sub(r'\bAnaysis\b', 'Analysis', subject, flags=re.IGNORECASE)
        subject = re.sub(r'\bExcercises\b', 'Exercises', subject, flags=re.IGNORECASE)
        subject = re.sub(r'\bQuantitaive\b', 'Quantitative', subject, flags=re.IGNORECASE)
        subject = re.sub(r'\bDigitial\b', 'Digital', subject, flags=re.IGNORECASE)
        subject = re.sub(r'\bImplmentation\b', 'Implementation', subject, flags=re.IGNORECASE)
        if course_code:
            course_code = re.sub(r'\s+', ' ', course_code).strip()
        return subject, course_code

    def extract_teacher_info(self, text: str, section: str = "") -> Tuple[str, str]:
        program_matches = []
        for pattern in self.program_patterns:
            for match in pattern.finditer(text):
                program_matches.append(match)
        if program_matches:
            last_match = max(program_matches, key=lambda m: m.end())
            try:
                gp2 = last_match.group(2)
                end_pos = last_match.start(2) + (len(gp2) if gp2 else 0)
            except IndexError:
                end_pos = last_match.end()
            after_program = text[end_pos:].strip()
            if after_program:
                sap_paren = re.search(r'\(\s*(\d{4,6})\s*\)', after_program)
                sap_match = sap_paren or re.search(r'(\d{4,6})', after_program)
                if sap_match:
                    sap_id = sap_match.group(1)
                    name_part = after_program[:sap_match.start()].strip()
                    name_part = re.sub(r'^\s*Room\b[\s#: -]*[A-Za-z0-9/\-]+\s*', '', name_part, flags=re.IGNORECASE).strip()
                    if name_part:
                        primary_name = re.split(r'\s*[,&/]\s*', name_part)[0]
                        primary_name = re.sub(r'^[^A-Za-z]+', '', primary_name)
                        primary_name = self._strip_leading_section_token(primary_name, text, section)
                        primary_name = self._strip_leading_program_token(primary_name)
                        primary_name = self._cleanup_name_tail(primary_name)
                        primary_name = self._normalize_teacher_title(self._cap_teacher_tokens(primary_name))
                        primary_name = re.sub(r'\s+(?:BS|BBA|BSAF|BSCS|BSSE|BSAI|Pharm-?D|DPT|RIT|HND)\b.*$', '', primary_name, flags=re.IGNORECASE)
                        primary_name = self._cleanup_name_tail(primary_name)
                        if primary_name:
                            return re.sub(r'\s+', ' ', primary_name), sap_id
                else:
                    clean_name = re.sub(r'\s+', ' ', after_program).strip()
                    clean_name = re.sub(r'^\s*Room\b[\s#: -]*[A-Za-z0-9/\-]+\s*', '', clean_name, flags=re.IGNORECASE).strip()
                    clean_name = re.sub(r'^[^A-Za-z]+', '', clean_name)
                    clean_name = self._strip_leading_section_token(clean_name, text, section)
                    clean_name = self._strip_leading_program_token(clean_name)
                    if clean_name and len(clean_name) > 2:
                        primary_name = re.split(r'\s*[,&/]\s*', clean_name)[0]
                        primary_name = self._cleanup_name_tail(primary_name)
                        primary_name = self._normalize_teacher_title(self._cap_teacher_tokens(primary_name))
                        primary_name = re.sub(r'\s+(?:BS|BBA|BSAF|BSCS|BSSE|BSAI|Pharm-?D|DPT|RIT|HND)\b.*$', '', primary_name, flags=re.IGNORECASE)
                        primary_name = self._cleanup_name_tail(primary_name)
                        if not re.search(r'\b(reserved|slot|department|used|class)\b', primary_name, flags=re.IGNORECASE):
                            if primary_name.strip().upper() in {"URDU","ENGLISH","ENG","MATH","MATHEMATICS","EDU","EDUCATION","IR","SISS","SSISS"}:
                                pass
                            elif re.match(r'^(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)(?:\b|\s)', primary_name) or re.match(r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$', primary_name):
                                return primary_name, ""
        for pattern in self.teacher_patterns:
            match = pattern.search(text)
            if match:
                if len(match.groups()) == 2:
                    name = match.group(1).strip()
                    sap_id = match.group(2)
                    primary_name = re.split(r'\s*[,&/]\s*', name)[0]
                    primary_name = re.sub(r'^\s*Room\b[\s#: -]*[A-Za-z0-9/\-]+\s*', '', primary_name, flags=re.IGNORECASE).strip()
                    primary_name = re.sub(r'^[^A-Za-z]+', '', primary_name)
                    primary_name = self._strip_leading_section_token(primary_name, text, section)
                    primary_name = self._strip_leading_program_token(primary_name)
                    primary_name = self._cleanup_name_tail(primary_name)
                    primary_name = self._normalize_teacher_title(self._cap_teacher_tokens(primary_name))
                    primary_name = re.sub(r'\s+(?:BS|BBA|BSAF|BSCS|BSSE|BSAI|Pharm-?D|DPT|RIT|HND)\b.*$', '', primary_name, flags=re.IGNORECASE)
                    primary_name = self._cleanup_name_tail(primary_name)
                    if re.match(r'^\s*(Bridging|merge\b|meerge\b)', primary_name, flags=re.IGNORECASE) or len(primary_name.split()) <= 3:
                        mfull = re.search(r'((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]+[A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*\(\s*(\d{4,6})\s*\)', text, flags=re.IGNORECASE)
                        if mfull:
                            nm2 = mfull.group(1)
                            nm2 = self._cleanup_name_tail(nm2)
                            primary_name = self._normalize_teacher_title(self._cap_teacher_tokens(nm2))
                            primary_name = re.sub(r'^\s*(?:Bridging|merge\s+with\s+[A-Za-z/&\s]+|meerge\s+with\s+SIS)\s+', '', primary_name, flags=re.IGNORECASE)
                            sap_id = mfull.group(2)
                    if re.search(r'\b(reserved|slot|department|used|class)\b', primary_name, flags=re.IGNORECASE):
                        continue
                    return re.sub(r'\s+', ' ', primary_name), sap_id
                else:
                    name = match.group(1).strip()
                    primary_name = re.split(r'\s*[,&/]\s*', name)[0]
                    primary_name = re.sub(r'^\s*Room\b[\s#: -]*[A-Za-z0-9/\-]+\s*', '', primary_name, flags=re.IGNORECASE).strip()
                    primary_name = re.sub(r'^[^A-Za-z]+', '', primary_name)
                    primary_name = self._strip_leading_section_token(primary_name, text, section)
                    primary_name = self._strip_leading_program_token(primary_name)
                    primary_name = self._cleanup_name_tail(primary_name)
                    primary_name = self._normalize_teacher_title(self._cap_teacher_tokens(primary_name))
                    primary_name = re.sub(r'\s+(?:BS|BBA|BSAF|BSCS|BSSE|BSAI|Pharm-?D|DPT|RIT|HND)\b.*$', '', primary_name, flags=re.IGNORECASE)
                    primary_name = self._cleanup_name_tail(primary_name)
                    if re.match(r'^\s*(Bridging|merge\b|meerge\b)', primary_name, flags=re.IGNORECASE) or len(primary_name.split()) <= 3:
                        mfull = re.search(r'((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]+[A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*\(\s*(\d{4,6})\s*\)', text, flags=re.IGNORECASE)
                        if mfull:
                            nm2 = mfull.group(1)
                            nm2 = self._cleanup_name_tail(nm2)
                            primary_name = self._normalize_teacher_title(self._cap_teacher_tokens(nm2))
                            primary_name = re.sub(r'^\s*(?:Bridging|merge\s+with\s+[A-Za-z/&\s]+|meerge\s+with\s+SIS)\s+', '', primary_name, flags=re.IGNORECASE)
                    if re.search(r'\b(reserved|slot|department|used|class)\b', primary_name, flags=re.IGNORECASE):
                        continue
                    after_name = text[match.end():]
                    sap_match = re.search(r'(\d{4,6})', after_name)
                    if sap_match:
                        return re.sub(r'\s+', ' ', primary_name), sap_match.group(1)
                    return re.sub(r'\s+', ' ', primary_name), ""

        # Fallback: capture full title+name followed by (SAP) and strip leading metadata like "Bridging"
        mfull = re.search(r'((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]+[A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*\(\s*(\d{4,6})\s*\)', text, flags=re.IGNORECASE)
        if mfull:
            nm = mfull.group(1)
            sap = mfull.group(2)
            # remove leading metadata words before title
            idx = re.search(r'(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)', nm).start()
            nm2 = nm[idx:]
            nm2 = self._cleanup_name_tail(self._normalize_teacher_title(self._cap_teacher_tokens(nm2)))
            nm2 = re.sub(r'^\s*(?:Bridging|merge\s+with\s+[A-Za-z/&\s]+|meerge\s+with\s+SIS)\s+', '', nm2, flags=re.IGNORECASE)
            return re.sub(r'\s+', ' ', nm2), sap

        return "", ""

    def _strip_leading_section_token(self, name: str, full_text: str, section: str) -> str:
        name2 = re.sub(r'^\(?\s*[IVX]{1,4}\s*-\s*[A-Z]\)?\s+', '', name)
        if name2 != name:
            return name2
        if section:
            if re.search(r'\b[IVX]{1,4}\s*-?\s*' + re.escape(section) + r'\b', full_text):
                if re.match(r'^\s*' + re.escape(section) + r'\b\s*', name):
                    return re.sub(r'^\s*' + re.escape(section) + r'\b\s*', '', name)
            roman = '|'.join(self.roman_numerals.keys())
            if re.search(r'\b(' + roman + r')\s*-?\s*' + re.escape(section) + r'\b', full_text):
                if re.match(r'^\s*' + re.escape(section) + r'\b\s*', name):
                    return re.sub(r'^\s*' + re.escape(section) + r'\b\s*', '', name)
        roman_letters = []
        for m in re.finditer(r'\b([IVX]{1,4})\s*(?:-\s*([A-Z])|\s*([A-Z]))\b', full_text):
            sec_candidate = m.group(2) or m.group(3)
            if sec_candidate:
                roman_letters.append(sec_candidate)
        if roman_letters:
            first = name.strip().split()[0] if name.strip().split() else ''
            if first and len(first) == 1 and first in roman_letters:
                return re.sub(r'^\s*' + re.escape(first) + r'\b\s*', '', name)
        return name

    def _strip_leading_program_token(self, name: str) -> str:
        name2 = re.sub(r'^\s*(?:[A-Z]{2,}\s*[-/]*\s*[IVX]+(?:\s*/\s*[A-Z]{2,}\s*[-/]*\s*[IVX]+)*)\s*,?\s*', '', name)
        name2 = re.sub(r'^\s*(?:BSCS|BSSE|BSAI|BBA2Y|BBA|BSAF2Y|BSAF|BSDM|BSFT|Pharm-?D|PharmD|BS|DPT|RIT|HND|MLT|SISS|SSISS)\b[\s-]*(?:[IVX]+|\d+)?(?:\s*-\s*[A-Z])?\s*', '', name2, flags=re.IGNORECASE)
        name2 = re.sub(r'^\s*(?:Math(?:ematics)?|MATH|MATHS)\b[\s-]*(?:[IVX]+|\d+)?\s*', '', name2, flags=re.IGNORECASE)
        name2 = re.sub(r'^\s*(?:ENG|English|Urdu)\b[\s-]*(?:[IVX]+|\d+)?\s*', '', name2, flags=re.IGNORECASE)
        name2 = re.sub(r'^\s*(?:Edu|Education|B\.?Ed)\b[\s-]*(?:[IVX]+|\d+)?\s*', '', name2, flags=re.IGNORECASE)
        name2 = re.sub(r'^\s*(?:IR)\b[\s-]*(?:[IVX]+|\d+)?\s*', '', name2, flags=re.IGNORECASE)
        name2 = re.sub(r'^\s*(?:B\.?S\.?)\b[\s-]*(?:[IVX]+|\d+)?\s*', '', name2, flags=re.IGNORECASE)
        name2 = re.sub(r'^\s*(?:[IVX]{1,4})(?:\s*[-/])?\s+(?=(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?))', '', name2)
        return name2

    def _cap_teacher_tokens(self, name: str, max_tokens: int = 4) -> str:
        parts = name.strip().split()
        if not parts:
            return name.strip()
        title_tokens = {"Dr.", "Dr", "Prof.", "Prof", "Mr.", "Mr", "Ms.", "Ms", "Miss.", "Miss", "Mufti.", "Mufti"}
        if parts[0] in title_tokens:
            after = parts[1:]
            special = {"e", "bin", "binti", "al", "ul", "ur"}
            limit = max_tokens
            for i in range(min(len(after), limit)):
                if after[i].lower() in special and i + 1 < len(after):
                    limit = min(max_tokens + 1, len(after))
            kept = [parts[0]] + after[:limit]
        else:
            kept = parts[:max_tokens]
        out = re.sub(r'\s+', ' ', ' '.join(kept)).strip()
        out = re.sub(r'[\(\)\[\]\{\},;.:]+$', '', out).strip()
        out = re.sub(r'\(\d{4,6}\)', '', out).strip()
        out = re.sub(r'\(\d{4,6}$', '', out).strip()
        out = re.sub(r'[A-Z]{3,}[\- ]?\d{3,}(?:\|\d+)?\s*', '', out).strip()
        toks = out.split()
        subject_like_suffixes = ("ship", "ment", "ing", "ion", "ance", "ics", "ology", "ography")
        subject_keywords = {"Entrepreneurship", "English", "Finance", "Marketing", "Quantitative", "Environmental", "Business", "Translation", "Understanding", "Industrial", "Operations", "Research", "Functional", "Creativity", "Innovation", "Science", "Law", "Taxation", "Product", "Development", "Sports", "Academic"}
        cut_index = None
        for idx in range(1, len(toks)):
            t = toks[idx]
            if t in subject_keywords:
                cut_index = idx
                break
            low = t.lower()
            if any(low.endswith(suf) for suf in subject_like_suffixes) and len(t) > 8:
                cut_index = idx
                break
        if cut_index is not None:
            out = ' '.join(toks[:cut_index])
        return out

    def _normalize_teacher_title(self, name: str) -> str:
        parts = name.strip().split()
        if not parts:
            return name.strip()
        female_first_names = {"Alishba", "Aneela", "Saba", "Sana", "Neeli", "Shaista", "Anam", "Aasma", "Kiran", "Maryam", "Muntaha", "Saira", "Bisma", "Ishwa", "Anam", "Aneeba", "Aasma"}
        if parts[0] in {"Mr.", "Mr"} and len(parts) > 1 and parts[1] in female_first_names:
            parts[0] = "Ms."
        return ' '.join(parts)

    def _cleanup_name_tail(self, name: str) -> str:
        s = name.strip()
        s = re.sub(r'\s*Room\b.*$', '', s, flags=re.IGNORECASE).strip()
        s = re.sub(r'\s*Lab\b.*$', '', s, flags=re.IGNORECASE).strip()
        s = re.sub(r'\s*\(SAP[^)]*\)\s*$', '', s, flags=re.IGNORECASE).strip()
        s = re.sub(r'\s*\([^)]*\)\s*$', '', s).strip()
        s = re.sub(r'[\(\)\[\]\{\},;.:]+$', '', s).strip()
        s = re.sub(r'\s+\d{1,2}\s*$', '', s).strip()
        s = re.sub(r'^\s*-?\s*(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\s+(?=[A-Z])', '', s)
        s = re.sub(r'^\s*(?:IR|R|I)\b\s+(?=[A-Z][a-z])', '', s)
        return re.sub(r'\s+', ' ', s)

    def _extract_global_programs(self, text: str) -> List[Tuple[str, str, str]]:
        result: List[Tuple[str, str, str]] = []
        seen = set()
        for pattern in self.program_patterns:
            for m in pattern.finditer(text):
                program = m.group(1)
                if program.lower() == 'bs' and len(m.groups()) >= 4 and isinstance(m.group(2), str):
                    spec = m.group(2).strip()
                    sem_raw = m.group(3)
                    sec = m.group(4) or ''
                    semester = self.convert_roman_to_numeric(sem_raw or '')
                    spec_norm = spec if spec.isupper() else spec.title()
                    prog_name = f"BS {spec_norm}"
                    key = (prog_name, semester, sec)
                    if key not in seen:
                        seen.add(key)
                        result.append(key)
                    continue
                semester_raw = m.group(2)
                section = m.group(3) if len(m.groups()) > 2 else ""
                semester = self.convert_roman_to_numeric(semester_raw)
                key = (program, semester, section)
                if key not in seen:
                    seen.add(key)
                    result.append(key)
        text_norm = re.sub(r'\s+', ' ', text)
        ignore_specs = {"QR", "Quantitative Reasoning", "Exploring Quantitative Skills", "General Mathematics"}
        spec_whitelist = {"Biotech", "Biotechnology", "Zoology", "Urdu", "English", "ENG", "Mathematics", "Math", "MATH", "MATHS", "Physics", "Psychology", "Criminology", "Chemistry", "Mathematics For Data Science", "IR", "Nursing", "SISS", "SSISS", "Education", "Edu", "B.Ed", "B.Edu", "PSY", "CRIMINOLOGY", "PHY"}
        for m in re.finditer(r'\bBS\s+([IVX]+|\d+)\s+([A-Za-z][A-Za-z&\.\s]+?)(?=,|/|\)|$)', text_norm):
            sem_raw = m.group(1)
            spec = m.group(2).strip()
            if spec.title() in ignore_specs:
                continue
            if (spec.isupper() and spec not in spec_whitelist) or (spec.title() not in spec_whitelist):
                continue
            semester = self.convert_roman_to_numeric(sem_raw)
            spec_norm = spec if spec.isupper() else spec.title()
            key = (f"BS {spec_norm}", semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        for m in re.finditer(r'\bBS\s*\(\s*([IVX]+|\d+)\s*\)\s+([A-Za-z][A-Za-z&\.\s]+?)(?=,|/|\)|$)', text_norm):
            sem_raw = m.group(1)
            spec = m.group(2).strip()
            if spec.title() in ignore_specs:
                continue
            if (spec.isupper() and spec not in spec_whitelist) or (spec.title() not in spec_whitelist):
                continue
            semester = self.convert_roman_to_numeric(sem_raw)
            spec_norm = spec if spec.isupper() else spec.title()
            key = (f"BS {spec_norm}", semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        for m in re.finditer(r'\bBS\s+([A-Za-z][A-Za-z&\.\s]+?)\s+([IVX]+|\d+)\b', text_norm):
            spec = m.group(1).strip()
            if spec.title() in ignore_specs:
                continue
            if (spec.isupper() and spec not in spec_whitelist) or (spec.title() not in spec_whitelist):
                continue
            sem_raw = m.group(2)
            semester = self.convert_roman_to_numeric(sem_raw)
            spec_norm = spec if spec.isupper() else spec.title()
            key = (f"BS {spec_norm}", semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        for m in re.finditer(r'\bBS\s+([A-Za-z][A-Za-z&\.\s]+?)\s*\(\s*([IVX]+|\d+)\s*\)\b', text_norm):
            spec = m.group(1).strip()
            if spec.title() in ignore_specs:
                continue
            if (spec.isupper() and spec not in spec_whitelist) or (spec.title() not in spec_whitelist):
                continue
            sem_raw = m.group(2)
            semester = self.convert_roman_to_numeric(sem_raw)
            spec_norm = spec if spec.isupper() else spec.title()
            key = (f"BS {spec_norm}", semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        for m in re.finditer(r'\bBS\s+([A-Za-z][A-Za-z&\.\s]+?)\s*[-/]\s*([IVX]+|\d+)\b', text_norm):
            spec = m.group(1).strip()
            if spec.title() in ignore_specs:
                continue
            if (spec.isupper() and spec not in spec_whitelist) or (spec.title() not in spec_whitelist):
                continue
            sem_raw = m.group(2)
            semester = self.convert_roman_to_numeric(sem_raw)
            spec_norm = spec if spec.isupper() else spec.title()
            key = (f"BS {spec_norm}", semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        # Multi-semester parentheses like "BS Math (3rd +0)"
        for m in re.finditer(r'\bBS\s+([A-Za-z][A-Za-z&\.\s]+?)\s*\(([^\)]*)\)', text_norm):
            spec = m.group(1).strip()
            span = m.group(2)
            if spec.title() in ignore_specs:
                continue
            if (spec.isupper() and spec not in spec_whitelist) or (spec.title() not in spec_whitelist):
                continue
            for tok in re.findall(r'([IVX]+|\d+(?:st|nd|rd|th)?|0)', span, flags=re.IGNORECASE):
                semester = self.convert_roman_to_numeric(tok)
                spec_norm = spec if spec.isupper() else spec.title()
                key = (f"BS {spec_norm}", semester, '')
                if key not in seen:
                    seen.add(key)
                    result.append(key)
        safe_specs = {"RIT", "HND", "IR", "MLT"}
        for m in re.finditer(r'\b([A-Za-z]{2,}[A-Za-z&\.\s]*)\s+BS\s+([IVX]+|\d{1,2})\b', text_norm):
            prog_raw = m.group(1).strip()
            prt = prog_raw.upper().replace('.', '').strip()
            if prog_raw.title() in ignore_specs:
                continue
            if prt not in safe_specs:
                continue
            sem_raw = m.group(2)
            semester = self.convert_roman_to_numeric(sem_raw)
            key = (prog_raw.title(), semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        for m in re.finditer(r'\b([A-Za-z]{2,}[A-Za-z&\.\s]*)\s+BS\s*\(\s*([IVX]+|\d{1,2})\s*\)\b', text_norm):
            prog_raw = m.group(1).strip()
            prt = prog_raw.upper().replace('.', '').strip()
            if prog_raw.title() in ignore_specs:
                continue
            if prt not in safe_specs:
                continue
            sem_raw = m.group(2)
            semester = self.convert_roman_to_numeric(sem_raw)
            key = (prog_raw.title(), semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        # Fallback for tokens like "BS 4 SISS" and "BS 1 SISS"
        for m in re.finditer(r'\bBS\s+([IVX]+|\d{1,2})\s+([A-Za-z]{2,})\b', text_norm):
            sem_raw = m.group(1)
            spec = m.group(2).strip()
            spec_norm = spec if spec.isupper() else spec.title()
            if spec_norm.title() in ignore_specs:
                continue
            if spec_norm.upper() in { 'SISS', 'SSISS' }:
                semester = self.convert_roman_to_numeric(sem_raw)
                key = (f"BS {('SISS' if spec_norm.upper()=='SSISS' else 'SISS')}", semester, '')
                if key not in seen:
                    seen.add(key)
                    result.append(key)
        for m in re.finditer(r'\bB\.?Ed(?:\s*[-/]?\s*([IVX]+|\d+))\b', text_norm):
            sem_raw = m.group(1) or ''
            semester = self.convert_roman_to_numeric(sem_raw) if sem_raw and sem_raw.isalpha() else sem_raw
            key = ("B.Ed", semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        anchor_prog = re.compile(r'\b(BSCS|BSSE|BSAI|BSMDS|BBA2Y|BBA|BSAF2Y|BSAF|BSDM|BSFT|Pharm-?D|PharmD|BS|DPT|RIT|HND|MLT)\b', re.IGNORECASE)
        for am in anchor_prog.finditer(text):
            prog = am.group(1).upper()
            tail = text[am.end():]
            mlocal = re.match(r"\s*(?:[-/]\s*)?([IVX]+|\d{1,2}(?:ST|ND|RD|TH)?)(?:\s*-\s*([A-Z]))?", tail)
            if mlocal:
                sem_raw = mlocal.group(1)
                sec = mlocal.group(2) or ''
                semester = self.convert_roman_to_numeric(sem_raw)
                key = (prog, semester, sec)
                if key not in seen:
                    seen.add(key)
                    result.append(key)
            else:
                if prog in {"BSCS","BSSE","BSAI","BSMDS","BBA2Y","BBA","BSAF2Y","BSAF","BSDM","BSFT","RIT","HND","MLT"}:
                    key = (prog, '', '')
                    if key not in seen:
                        seen.add(key)
                        result.append(key)
        for m in re.finditer(r"\b((?:RIT|HND|MLT)(?:\s*(?:[,/&]|\band\b)\s*(?:RIT|HND|MLT))+)[\s,&/\-]*([IVX]+|\d{1,2}(?:ST|ND|RD|TH)?)", text_norm):
            list_chunk = m.group(1)
            sem_raw = m.group(2)
            semester = self.convert_roman_to_numeric(sem_raw)
            for prg in re.findall(r"\b(RIT|HND|MLT)\b", list_chunk):
                key = (prg.upper(), semester, '')
                if key not in seen:
                    seen.add(key)
                    result.append(key)
        for m in re.finditer(r"\b(RIT|HND|MLT)\b\s*[-/&,]*\s*([IVX]+|\d{1,2}(?:ST|ND|RD|TH)?)", text_norm):
            prog = m.group(1).upper()
            sem_raw = m.group(2)
            semester = self.convert_roman_to_numeric(sem_raw)
            key = (prog, semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)

        # Handle patterns like "BSAF 2Y(I)" or "BBA 2Y-IV" where 2Y variant is separated
        for m in re.finditer(r"\b(BSAF|BBA|BSDM|BSFT)\b\s*2Y\s*\(\s*([IVX]+|\d{1,2})\s*\)", text_norm):
            prog = m.group(1).upper() + '2Y'
            sem_raw = m.group(2)
            semester = self.convert_roman_to_numeric(sem_raw)
            key = (prog, semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        for m in re.finditer(r"\b(BSAF|BBA|BSDM|BSFT)\b\s*2Y\s*[-/]\s*([IVX]+|\d{1,2})\b", text_norm):
            prog = m.group(1).upper() + '2Y'
            sem_raw = m.group(2)
            semester = self.convert_roman_to_numeric(sem_raw)
            key = (prog, semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        for m in re.finditer(r"\b(BSAF|BBA|BSDM|BSFT)\b\s*2Y\b", text_norm):
            prog = m.group(1).upper() + '2Y'
            key = (prog, '', '')
            if key not in seen:
                seen.add(key)
                result.append(key)

        # BS-VII-PSY form
        for m in re.finditer(r"\bBS\s*[-]?\s*([IVX]+|\d{1,2})\s*[-]\s*([A-Z]{2,})\b", text_norm):
            sem_raw = m.group(1)
            spec = m.group(2)
            semester = self.convert_roman_to_numeric(sem_raw)
            spec_norm = spec if spec.isupper() else spec.title()
            key = (f"BS {spec_norm}", semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        # Handle comma-separated semesters like "BS II, VI"
        for m in re.finditer(r"\bBS\s+((?:[IVX]+|\d{1,2})(?:\s*,\s*(?:[IVX]+|\d{1,2}))+)(?=\b|\s)", text_norm):
            list_chunk = m.group(1)
            for tok in re.findall(r"[IVX]+|\d{1,2}", list_chunk):
                semester = self.convert_roman_to_numeric(tok)
                key = ("BS", semester, '')
                if key not in seen:
                    seen.add(key)
                    result.append(key)
        for m in re.finditer(r"\b(Biotech|Biotechnology|Chemistry|Zoology|English|ENG|Mathematics|Math|MATH|MATHS|Physics|Psychology|IR)\b\s*-?\s*([IVX]+|\d{1,2})\b", text_norm):
            spec = m.group(1)
            sem_raw = m.group(2)
            if spec.upper() in {"RIT","HND","DPT"}:
                continue
            semester = self.convert_roman_to_numeric(sem_raw)
            spec_norm = spec if spec.isupper() else spec.title()
            key = (f"BS {spec_norm}", semester, '')
            if key not in seen:
                seen.add(key)
                result.append(key)
        if result:
            best = {}
            for p,s,sec in result:
                k = (p,s)
                if k not in best or (best[k] == '' and sec):
                    best[k] = sec
            uniq = []
            seen2 = set()
            for p,s in best:
                k = (p,s,best[(p,s)])
                if k not in seen2:
                    seen2.add(k)
                    uniq.append(k)
            norm = []
            for p,s,sec in uniq:
                if p.startswith('BS '):
                    spec = p[3:].strip()
                    spec2 = spec if spec.isupper() else spec.title()
                    syn = {
                        'Maths': 'Mathematics',
                        'MATHS': 'Mathematics',
                        'Math': 'Mathematics',
                        'MATH': 'Mathematics',
                        'ENG': 'English',
                        'Edu': 'Education',
                        'SSISS': 'SISS',
                        'URDU': 'Urdu'
                    }
                    spec2 = syn.get(spec2, spec2)
                    p = 'BS ' + spec2
                elif p.isalpha():
                    if p.upper().startswith('BS'):
                        p = p.upper()
                    elif len(p) <= 4:
                        p = p.upper()
                    else:
                        p = p.title()
                norm.append((p,s,sec))
            # de-duplicate case-insensitively
            uniq = []
            seen_ci = set()
            for p,s,sec in norm:
                kci = (p.lower(), s, sec)
                if kci not in seen_ci:
                    seen_ci.add(kci)
                    uniq.append((p,s,sec))
            drop_titles = {"Dr", "Dr.", "Mr", "Mr.", "Ms", "Ms.", "Miss", "Miss.", "Mufti", "Mufti."}
            uniq = [t for t in uniq if not (t[0].startswith('BS ') and t[0].split()[1] in drop_titles)]
            spec_sems = {s for p,s,_ in uniq if p.startswith('BS ') and p != 'BS'}
            if spec_sems:
                uniq = [t for t in uniq if not (t[0] == 'BS' and t[1] in spec_sems)]
            non_bs_sems = {s for p,s,_ in uniq if not p.startswith('BS')}
            uniq = [t for t in uniq if not (t[0] == 'BS' and t[1] in non_bs_sems)]
            # Keep semester '0' tokens for merged classes (e.g., BS Math (3rd +0))
            nums = [int(s) for _,s,_ in uniq if s and s.isdigit() and int(s) > 0]
            fill = ''
            if '1' in [s for _,s,_ in uniq]:
                fill = '1'
            elif nums:
                fill = str(min(nums))
            if fill:
                anchor_fill = {"BSCS","BSSE","BSAI","BSMDS","BBA2Y","BBA","BSAF2Y","BSAF","BSDM","BSFT","RIT","HND","MLT"}
                uniq = [(p, (fill if (((p.startswith('BS ') or p in anchor_fill)) and s == '') else s), sec) for (p,s,sec) in uniq]
            # Normalize non-BS program names like B.Edu -> B.Ed
            norm2 = []
            for p,s,sec in uniq:
                if not p.startswith('BS '):
                    if re.match(r'^B\.?Edu$', p, flags=re.IGNORECASE):
                        p = 'B.Ed'
                norm2.append((p,s,sec))
            # Final de-duplication
            seen_final = set()
            out_final = []
            for p,s,sec in norm2:
                k = (p.lower(), s, sec)
                if k not in seen_final:
                    seen_final.add(k)
                    out_final.append((p,s,sec))
            result = out_final
        return result

    def _assign_programs_to_entries(self, entries: List[Dict[str, str]], full_text: str) -> List[Dict[str, str]]:
        globals_list = self._extract_global_programs(full_text)
        if not globals_list:
            return entries
        missing = [i for i,e in enumerate(entries) if not e.get('program')]
        if not missing:
            return entries
        if len(globals_list) == len(entries):
            for i in range(len(entries)):
                if not entries[i].get('program'):
                    p,s,sec = globals_list[i]
                    entries[i]['program'] = p
                    entries[i]['semester'] = s
                    entries[i]['section'] = sec
            return entries
        if len(globals_list) == 1:
            p,s,sec = globals_list[0]
            for i in missing:
                entries[i]['program'] = p
                entries[i]['semester'] = s
                entries[i]['section'] = sec
            return entries
        for idx,i in enumerate(missing):
            j = min(idx, len(globals_list)-1)
            p,s,sec = globals_list[j]
            entries[i]['program'] = p
            entries[i]['semester'] = s
            entries[i]['section'] = sec
        return entries

    def _is_program_metadata_segment(self, segment: str, subject: str) -> bool:
        s = (subject or '').strip()
        seg = (segment or '').strip()
        if not s:
            return True
        if re.fullmatch(r'[\s,\-/()]+', s):
            return True
        if re.match(r'^\s*[\(,]*\s*(?:BSCS|BSSE|BSAI|BBA2Y|BBA|BSAF2Y|BSAF|BSDM|BSFT|Pharm-?D|PharmD|BS|DPT|RIT|HND|MLT)\b', s, flags=re.IGNORECASE):
            return True
        if re.match(r'^\s*[\(,]*\s*(?:BSCS|BSSE|BSAI|BBA2Y|BBA|BSAF2Y|BSAF|BSDM|BSFT|Pharm-?D|PharmD|BS|DPT|RIT|HND|MLT)\b', seg, flags=re.IGNORECASE):
            return True
        if re.match(r'^\s*,\s*$', seg):
            return True
        return False

    def convert_roman_to_numeric(self, roman: str) -> str:
        if roman is None:
            return ""
        ru = str(roman).upper().strip()
        m = re.match(r'^(\d+)(?:ST|ND|RD|TH)?$', ru)
        if m:
            return m.group(1)
        if ru.isdigit():
            return ru
        return self.roman_numerals.get(ru, str(roman))

    def is_reserved_cell(self, content: str) -> bool:
        if not content or not content.strip():
            return True
        text = content.strip()
        has_program = any(p.search(text) for p in self.program_patterns)
        has_course = any(c.search(text) for c in self.course_code_patterns)
        if has_program or has_course:
            return False
        return bool(self.reserved_regex.search(text))

    def infer_program_from_context(self, department: str, text: str) -> str:
        m = re.search(r'\bPharm-?D\b|\bPharmD\b', text, flags=re.IGNORECASE)
        if m:
            return "PharmD"
        if department.upper() == "PHARM-D":
            return "PharmD"
        m2 = re.search(r'\bDPT\b', text)
        if m2 or department.upper() == "DPT":
            return "DPT"
        if re.search(r'HND', department, flags=re.IGNORECASE) or department.strip().lower() == 'human nutrition and dietetics':
            return "HND"
        return ""

    def extract_semester_section_from_any(self, text: str) -> Tuple[str, str]:
        anchored = re.search(r'\b(?:BSCS|BSSE|BSAI|BBA2Y|BBA|BSAF2Y|BSAF|BSDM|BSFT|Pharm-?D|PharmD|BS|DPT|RIT|HND|MLT)\b[\s-]*([IVX]+|\d+(?:ST|ND|RD|TH)?)\s*(?:-\s*([A-Z])(?![A-Za-z]))?', text, flags=re.IGNORECASE)
        if anchored:
            sem = self.convert_roman_to_numeric(anchored.group(1))
            sec = anchored.group(2) or ""
            return sem, sec
        m = re.search(r'\b([IVX]{1,4})\s*-\s*([A-Z])(?![A-Za-z])\b', text)
        if m:
            sem = self.convert_roman_to_numeric(m.group(1))
            sec = m.group(2)
            if re.match(r'\bRoom\b', text[m.end():], flags=re.IGNORECASE):
                return sem, ""
            return sem, sec
        sm = re.search(r'\bSemester\s*#?\s*([IVX]+|\d+(?:ST|ND|RD|TH)?)\b', text, flags=re.IGNORECASE)
        if sm:
            return self.convert_roman_to_numeric(sm.group(1)), ""
        sm2 = re.search(r'\b(\d{1,2})(?:ST|ND|RD|TH)\s*sem(?:ester|ster)\b', text, flags=re.IGNORECASE)
        if sm2:
            return sm2.group(1), ""
        # Do not allow ambiguous "roman + capital" without a hyphen; too prone to false positives
        # e.g., "VII Ms" would incorrectly yield (6, 'I') due to overlapping capture
        return "", ""


def parse_csv_content(file_content: str) -> List[Dict[str, str]]:
    parser = AdvancedTimetableParser()
    return parser.parse_csv_file(file_content)

def build_allowed_index(file_content: str) -> Dict[str, Dict[str, List[str]]]:
    parser = AdvancedTimetableParser()
    csv_reader = csv.reader(io.StringIO(file_content), skipinitialspace=True)
    rows = list(csv_reader)
    parser._build_allowed_index(rows)
    out = {}
    for dept, subs in parser.allowed_subdepts_by_dept.items():
        out[dept] = sorted(list(subs))
    return {'departments': sorted(list(parser.allowed_departments)), 'subdepartments': out}
