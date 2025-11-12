import csv
import io
import re
import logging
from typing import List, Dict, Optional, Tuple, Set

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AdvancedTimetableParser:
    """
    Advanced CSV parser that handles complex spreadsheet structures including:
    1. Merged cells that span multiple time slots (3-hour labs)
    2. Classes that appear in multiple rows due to CSV export issues
    3. Complex cell structures from spreadsheet merging
    4. Lab sessions that span multiple time periods
    """

    def __init__(self):
        """Initialize with comprehensive patterns for complex CSV structures."""
        
        # Department pattern
        self.department_pattern = re.compile(r'^([A-Z][A-Za-z\s&/()\-\']{2,60})\s*-\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)', re.IGNORECASE)
        
        # Time slot pattern
        self.time_slot_pattern = re.compile(r'(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})')
        
        # Room patterns
        self.capacity_pattern = re.compile(r'S\.?C\.?\s*:\s*(\d+)', re.IGNORECASE)
        self.sap_room_pattern = re.compile(r'([A-Z]-[A-Z0-9\-]+)')
        
        # Course code patterns - comprehensive
        self.course_code_patterns = [
            # Plain code with optional slash suffix (e.g., QURT1111/14)
            re.compile(r'\b([A-Z]+)\s*[-]?\s*(\d{3,5})(?:/\d{1,2})?\b'),
            # Parenthesized with space or no space
            re.compile(r'\(([A-Z]+)\s*(\d{3,5})(?:/\d{1,2})?\)'),
            re.compile(r'\(([A-Z]+)(\d{3,5})(?:/\d{1,2})?\)'),
            # Hyphenated code
            re.compile(r'\b([A-Z]+)\s*[-]\s*(\d{3,5})\b'),
        ]
        
        # Program patterns - handles concatenated and spaced formats
        self.program_patterns = [
            # CS & IT patterns with sections
            re.compile(r'(BSCS)[-]?(\d+)([A-Z])(?![a-z])'),         # BSCS-5C, BSCS5C
            re.compile(r'(BSSE)[-]?(\d+)([A-Z])(?![a-z])'),         # BSSE-7A, BSSE7A
            re.compile(r'(BSAI)[-]?(\d+)([A-Z])(?![a-z])'),         # BSAI-2A, BSAI2A
            
            # CS & IT patterns without sections
            re.compile(r'(BSCS)[-]?(\d+)(?![A-Za-z])'),             # BSCS-6, BSCS6
            re.compile(r'(BSSE)[-]?(\d+)(?![A-Za-z])'),             # BSSE-8, BSSE8
            re.compile(r'(BSAI)[-]?(\d+)(?![A-Za-z])'),             # BSAI-1, BSAI1
            
            # PharmD patterns
            re.compile(r'(Pharm-?D)\s+([IVX]+)\s*(?:-\s*([A-Z]))?'),     # Pharm-D V-A / PharmD V
            re.compile(r'(PharmD)\s+([IVX]+)(?![A-Za-z])'),               # PharmD V
            
            # Business patterns
            re.compile(r'(BBA)[-]?([IVX]+)([A-Z]?)(?![a-z])'),      # BBA-VIII, BBAVIII
            re.compile(r'(BBA2Y)[-]?([IVX]+)([A-Z]?)(?![a-z])'),    # BBA2Y-IV
            re.compile(r'(BSAF)[-]?([IVX]+)([A-Z]?)(?![a-z])'),     # BSAF-II
            re.compile(r'(BSAF2Y)[-]?([IVX]+)([A-Z]?)(?![a-z])'),   # BSAF2Y-I
            re.compile(r'(BSDM)[-]?([IVX]+)([A-Z]?)(?![a-z])'),     # BSDM-III
            re.compile(r'(BSFT)[-]?([IVX]+)([A-Z]?)(?![a-z])'),     # BSFT-I
            
            # Other patterns
            re.compile(r'(BS)\s+(\d+)([A-Z]?)(?![a-z])'),           # BS 3A, BS 8, BS ISLAMIC STUDIES 1
            re.compile(r'(BS)[-]?([IVX]+)([A-Z]?)(?![a-z])'),       # BS-V, BSV
            re.compile(r'(DPT)[-]?([IVX]+)([A-Z]?)(?![a-z])'),      # DPT-V, DPTV
            re.compile(r'(RIT)[-]?([IVX]+)([A-Z]?)(?![a-z])'),      # RIT-III, RITIII
            re.compile(r'(HND)[-]?([IVX]+)([A-Z]?)(?![a-z])'),      # HND-II, HNDII
        ]
        
        # Teacher patterns - comprehensive
        self.teacher_patterns = [
            # With titles and SAP ID at end
            re.compile(r'\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?)\s+[A-Za-z\s\.]+[A-Za-z])\s*(\d{4,6})\s*$'),
            # Name with SAP ID in parentheses at end: Mufti Dilawar Khan (16518)
            re.compile(r'\b([A-Za-z][A-Za-z\s\.]+[A-Za-z])\s*\((\d{4,6})\)\s*$'),
            # Name with SAP ID (no title)
            re.compile(r'\b([A-Za-z][A-Za-z\s\.]+[A-Za-z])\s*(\d{4,6})\s*$'),
            # Just title and name (no SAP ID)
            re.compile(r'\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?)\s+[A-Za-z\s\.]+[A-Za-z])\s*$'),
            # Just name (no title, no SAP ID)
            re.compile(r'\b([A-Za-z][A-Za-z\s\.]{2,}[A-Za-z])\s*$'),
        ]

        # Roman numeral conversion
        self.roman_numerals = {
            'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
            'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10'
        }

        # Reserved patterns to skip (only when cell is purely reserved)
        self.reserved_patterns = [
            r'^\s*reserved\s*$',
            r'^\s*cs\s*reserved\s*$',
            r'^\s*math\s*reserved\s*$',
            r'^\s*dms\s*reserved\s*$',
            r'^\s*slot\s*used\s*$',
            r'^\s*new\s*hiring\s*$',
            r'^\s*new\s*appointment\s*$'
        ]
        self.reserved_regex = re.compile('|'.join(self.reserved_patterns), re.IGNORECASE)

    def parse_csv_file(self, file_content: str) -> List[Dict[str, str]]:
        """Advanced parsing that handles complex CSV structures."""
        try:
            # Use StringIO to preserve multi-line quoted fields
            csv_reader = csv.reader(io.StringIO(file_content), skipinitialspace=True)
            rows = list(csv_reader)
            logger.info(f"Loaded {len(rows)} rows from CSV file")
            
            parsed_entries = []
            current_department = None
            current_day = None
            current_time_slots = []
            
            # Store the raw grid for advanced processing
            self.raw_grid = rows
            
            i = 0
            while i < len(rows):
                row = rows[i]
                
                # Skip empty rows
                if not row or all(cell.strip() == '' for cell in row):
                    i += 1
                    continue
                
                # Check for department header
                dept_info = self.extract_department_info(row)
                if dept_info:
                    current_department, current_day = dept_info
                    current_time_slots = []
                    logger.info(f"Found department: {current_department}, Day: {current_day}")
                    i += 1
                    continue
                
                # Check for time slot headers
                if current_department and not current_time_slots:
                    time_slots = self.extract_time_slots(row)
                    if time_slots:
                        current_time_slots = time_slots
                        logger.info(f"Found {len(current_time_slots)} time slots for {current_department}")
                        i += 1
                        continue
                
                # Process room rows with advanced logic
                if current_department and current_time_slots and len(row) > 0:
                    room_name = row[0].strip()
                    
                    # Skip header rows like "Room/Labs" only, but keep actual room rows
                    if re.search(r'Room\s*/\s*Labs', room_name, re.IGNORECASE):
                        i += 1
                        continue
                    
                    # Extract room information (may be empty for supplemental rows)
                    room_capacity = self.extract_capacity(room_name)
                    sap_room_id = self.extract_sap_room_id(room_name)
                    
                    # Advanced processing: look for merged cells and spanning content
                    entries = self.process_room_row_advanced(
                        row, i, current_department, current_day,
                        current_time_slots, room_name, room_capacity, sap_room_id
                    )
                    
                    parsed_entries.extend(entries)
                
                i += 1
            
            # Post-processing: merge related entries and handle lab sessions
            final_entries = self.post_process_entries(parsed_entries)
            
            logger.info(f"Successfully parsed {len(final_entries)} class entries")
            return final_entries
            
        except Exception as e:
            logger.error(f"Error parsing CSV file: {str(e)}")
            raise ValueError(f"CSV parsing failed: {str(e)}")

    def process_room_row_advanced(self, row: List[str], row_index: int, department: str, day: str,
                                time_slots: List[str], room_name: str, room_capacity: str,
                                sap_room_id: str) -> List[Dict[str, str]]:
        """Advanced processing of room rows that handles merged cells and spanning content."""
        entries = []
        
        # Process each time slot column
        for col_idx in range(1, min(len(row), len(time_slots) + 1)):
            if col_idx >= len(row):
                break
                
            cell_content = row[col_idx].strip()
            if not cell_content or self.is_reserved_cell(cell_content):
                continue
            
            # Check if this cell might be part of a merged cell by looking at adjacent cells
            extended_content = self.get_extended_cell_content(row_index, col_idx, cell_content)
            
            # Parse the extended content
            class_entries = self.parse_class_entry_comprehensive(
                extended_content, department, day, time_slots[col_idx - 1],
                room_name, room_capacity, sap_room_id
            )
            
            # Check if this is a lab session that spans multiple time slots
            lab_entries = self.detect_lab_sessions(
                extended_content, department, day, time_slots, col_idx - 1,
                room_name, room_capacity, sap_room_id
            )
            
            entries.extend(class_entries)
            entries.extend(lab_entries)
        
        return entries

    def get_extended_cell_content(self, row_index: int, col_index: int, base_content: str) -> str:
        """Get extended content by looking at adjacent cells for merged content."""
        extended_content = base_content
        
        # Look at the next few cells in the same row to see if they contain related content
        if row_index < len(self.raw_grid):
            current_row = self.raw_grid[row_index]
            
            # Check next 2 columns for continuation
            for next_col in range(col_index + 1, min(col_index + 3, len(current_row))):
                next_cell = current_row[next_col].strip()
                if next_cell and not self.is_reserved_cell(next_cell):
                    # Check if this looks like a continuation (no program info, just teacher/details)
                    if not any(pattern.search(next_cell) for pattern in self.program_patterns):
                        extended_content += " " + next_cell
        
        # Look at the next row in the same column for continuation
        if row_index + 1 < len(self.raw_grid):
            next_row = self.raw_grid[row_index + 1]
            if col_index < len(next_row):
                next_row_cell = next_row[col_index].strip()
                if next_row_cell and not self.is_reserved_cell(next_row_cell):
                    # Check if this is a continuation (starts with lowercase or is just teacher info)
                    if (next_row_cell[0].islower() or 
                        not any(pattern.search(next_row_cell) for pattern in self.program_patterns)):
                        extended_content += " " + next_row_cell
        
        return extended_content

    def detect_lab_sessions(self, content: str, department: str, day: str, time_slots: List[str],
                          start_slot_index: int, room_name: str, room_capacity: str,
                          sap_room_id: str) -> List[Dict[str, str]]:
        """Detect lab sessions that might span multiple time slots."""
        lab_entries = []
        
        # Determine if the content indicates a lab session
        subject_text, course_code_text = self.extract_subject_and_course_code(content)
        is_lab = False
        if re.search(r'\bLAB\b|\bLab\b|\bLaboratory\b|\bPractical\b', content, re.IGNORECASE):
            is_lab = True
        # Course codes ending with L often denote labs (e.g., CS-313L)
        if re.search(r'\b[A-Z]+[- ]?\d{3,4}L\b', content):
            is_lab = True
        # Subject explicitly mentions lab
        if re.search(r'\bLAB\b|\bLab\b', subject_text):
            is_lab = True

        if is_lab:
            # Extract program information
            program_matches = []
            for pattern in self.program_patterns:
                matches = pattern.findall(content)
                for match in matches:
                    if isinstance(match, tuple) and len(match) >= 2:
                        program = match[0]
                        semester_raw = match[1]
                        section = match[2] if len(match) > 2 else ""
                        
                        # Convert semester
                        semester = self.convert_roman_to_numeric(semester_raw) if semester_raw.isalpha() else semester_raw
                        program_matches.append((program, semester, section))
            
            # If this is a lab, create entries for multiple time slots (typically 3 hours)
            if program_matches:
                span = min(3, len(time_slots) - start_slot_index)
                for slot_offset in range(span):
                    slot_index = start_slot_index + slot_offset
                    if slot_index < len(time_slots):
                        for program, semester, section in program_matches:
                            lab_entry = self.create_class_entry(
                                content, department, day, time_slots[slot_index],
                                room_name, room_capacity, sap_room_id,
                                program, semester, section
                            )
                            lab_entry['is_lab_session'] = 'true'
                            lab_entry['lab_duration'] = '3_hours'
                            lab_entries.append(lab_entry)
        
        return lab_entries

    def parse_class_entry_comprehensive(self, cell_content: str, department: str, day: str,
                                      time_slot: str, room_name: str, room_capacity: str,
                                      sap_room_id: str) -> List[Dict[str, str]]:
        """Parse class entries with maximum accuracy."""
        if not cell_content or self.is_reserved_cell(cell_content):
            return []

        # Clean up content
        content = ' '.join(line.strip() for line in cell_content.split('\n') if line.strip())
        
        # Extract all program matches
        all_program_matches = []
        for pattern in self.program_patterns:
            matches = pattern.findall(content)
            for match in matches:
                if isinstance(match, tuple) and len(match) >= 2:
                    program = match[0]
                    semester_raw = match[1]
                    section = match[2] if len(match) > 2 else ""
                    
                    # Convert semester
                    semester = self.convert_roman_to_numeric(semester_raw) if semester_raw.isalpha() else semester_raw
                    
                    all_program_matches.append((program, semester, section))
        
        # If no programs found, create a single entry
        if not all_program_matches:
            return [self.create_class_entry(content, department, day, time_slot,
                                          room_name, room_capacity, sap_room_id, "", "", "")]
        
        # Remove duplicates
        seen = set()
        unique_matches = []
        for match in all_program_matches:
            if match not in seen:
                seen.add(match)
                unique_matches.append(match)
        
        # Create entries for each unique program
        entries = []
        for program, semester, section in unique_matches:
            entry = self.create_class_entry(content, department, day, time_slot,
                                          room_name, room_capacity, sap_room_id,
                                          program, semester, section)
            entries.append(entry)
        
        return entries

    def post_process_entries(self, entries: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Post-process entries to handle duplicates and merge related entries."""
        # Remove exact duplicates
        seen_entries = set()
        unique_entries = []
        
        for entry in entries:
            # Create a key for duplicate detection
            key = (
                entry.get('department', ''),
                entry.get('program', ''),
                entry.get('semester', ''),
                entry.get('section', ''),
                entry.get('subject', ''),
                entry.get('time_slot', ''),
                entry.get('room_name', '')
            )
            
            if key not in seen_entries:
                seen_entries.add(key)
                unique_entries.append(entry)
        
        return unique_entries

    def extract_department_info(self, row: List[str]) -> Optional[Tuple[str, str]]:
        """Extract department name and day."""
        if not row:
            return None
            
        first_cell = row[0].strip()
        match = self.department_pattern.match(first_cell)
        if match:
            department = match.group(1).strip()
            day = match.group(2).strip()
            
            # Clean up department name
            department = re.sub(r'\s+', ' ', department)
            department = department.strip().strip('"\'')
            
            return department, day
        
        return None

    def extract_time_slots(self, row: List[str]) -> List[str]:
        """Extract time slots from header row."""
        time_slots = []
        
        for cell in row[1:]:
            if not cell:
                continue
                
            cell = cell.strip()
            if self.time_slot_pattern.search(cell):
                time_slots.append(cell)
        
        return time_slots

    def extract_capacity(self, room_text: str) -> str:
        """Extract room capacity."""
        match = self.capacity_pattern.search(room_text)
        return match.group(1) if match else ""

    def extract_sap_room_id(self, room_text: str) -> str:
        """Extract SAP room ID."""
        match = self.sap_room_pattern.search(room_text)
        return match.group(1) if match else ""

    def create_class_entry(self, content: str, department: str, day: str, time_slot: str,
                          room_name: str, room_capacity: str, sap_room_id: str,
                          program: str, semester: str, section: str) -> Dict[str, str]:
        """Create a single class entry with sub-department handling."""
        
        # Extract subject and course code
        subject, course_code = self.extract_subject_and_course_code(content)
        
        # Extract teacher information
        teacher_name, teacher_sap_id = self.extract_teacher_info(content)
        
        # If the room name is empty (supplemental rows), try to pull inline room info
        if not room_name:
            inline_room = self.extract_inline_room(content)
            if inline_room:
                room_name = inline_room
        
        # Determine sub-department based on program
        sub_department = self.get_sub_department(department, program)
        
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

    def extract_inline_room(self, text: str) -> str:
        """Extract inline room information from free-form text (e.g., 'Room#703' or 'Room # 605')."""
        # Common formats: Room#703, Room #703, Room # 605
        m = re.search(r'Room\s*#\s*(\d+)', text, flags=re.IGNORECASE)
        if m:
            return f"Room#{m.group(1)}"

        # Fallback: capture 'Room' followed by an identifier token
        m2 = re.search(r'\bRoom\s*[#:]*\s*([A-Z0-9\-/]+)', text, flags=re.IGNORECASE)
        if m2:
            return f"Room {m2.group(1)}"

        return ""

    def get_sub_department(self, department: str, program: str) -> str:
        """Determine sub-department based on department and program."""
        
        # CS & IT sub-departments
        if department == "CS & IT":
            if program == "BSCS":
                return "Computer Science"
            elif program == "BSSE":
                return "Software Engineering"
            elif program == "BSAI":
                return "Artificial Intelligence"
            else:
                return "CS & IT General"
        
        # LAHORE BUSINESS SCHOOL sub-departments
        elif department == "LAHORE BUSINESS SCHOOL":
            if program in ["BBA", "BBA2Y"]:
                return "Business Administration"
            elif program in ["BSAF", "BSAF2Y"]:
                return "Accounting & Finance"
            elif program == "BSDM":
                return "Digital Marketing"
            elif program == "BSFT":
                return "Financial Technology"
            else:
                return "Business General"
        
        # ENGLISH sub-departments
        elif department == "ENGLISH":
            if program == "BS":
                return "English Literature"
            else:
                return "English General"
        
        # ZOOLOGY sub-departments
        elif department == "ZOOLOGY":
            if program == "BS":
                return "Zoology"
            else:
                return "Zoology General"
        
        # CHEMISTRY sub-departments
        elif department == "CHEMISTRY":
            if program == "BS":
                return "Chemistry"
            else:
                return "Chemistry General"
        
        # MATHEMATICS sub-departments
        elif department == "MATHEMATICS":
            if program == "BS":
                return "Mathematics"
            else:
                return "Mathematics General"
        
        # PHYSICS sub-departments
        elif department == "PHYSICS":
            if program == "BS":
                return "Physics"
            else:
                return "Physics General"
        
        # PSYCHOLOGY sub-departments
        elif department == "PSYCHOLOGY":
            if program == "BS":
                return "Psychology"
            else:
                return "Psychology General"
        
        # BIO TECHNOLOGY sub-departments
        elif department == "BIO TECHNOLOGY":
            if program == "BS":
                return "Biotechnology"
            else:
                return "Biotechnology General"
        
        # Medical departments
        elif department == "DPT":
            return "Doctor of Physical Therapy"
        elif department == "Radiology and Imaging Technology/Medical Lab Technology":
            if program == "RIT":
                return "Radiology & Imaging Technology"
            elif program == "HND":
                return "Medical Lab Technology"
            else:
                return "Medical Technology General"
        elif department == "School of Nursing":
            return "Nursing"
        
        # PHARM-D
        elif department == "PHARM-D":
            return "Pharmacy"
        
        # EDUCATION
        elif department == "EDUCATION":
            return "Education"
        
        # SSISS (Social Sciences)
        elif department == "SSISS":
            return "Social Sciences"
        
        # URDU
        elif department == "URDU":
            return "Urdu Literature"
        
        # ISLAMIC STUDY
        elif department == "ISLAMIC STUDY":
            return "Islamic Studies"
        
        # Default: return the department name
        else:
            return department

    def extract_subject_and_course_code(self, text: str) -> Tuple[str, str]:
        """Extract subject name and course code."""
        course_code = ""
        subject = ""
        
        # Try to find course code first
        course_code_match = None
        for pattern in self.course_code_patterns:
            match = pattern.search(text)
            if match:
                course_code_match = match
                # Normalize course code as "PREFIX DIGITS"
                course_code = f"{match.group(1)} {match.group(2)}"
                break
        
        if course_code_match:
            # Subject is everything before the course code
            subject = text[:course_code_match.start()].strip()
        else:
            # Find subject before program info
            program_match = None
            for pattern in self.program_patterns:
                match = pattern.search(text)
                if match:
                    program_match = match
                    break
            
            if program_match:
                subject = text[:program_match.start()].strip()
            else:
                # Take first part as subject
                words = text.split()
                if len(words) > 4:
                    subject = ' '.join(words[:4])
                else:
                    subject = text
        
        # Clean up subject: remove trailing room markers and common noise
        subject = re.sub(r'\bRoom\b.*$', '', subject, flags=re.IGNORECASE)
        subject = re.sub(r'\bLab\b.*$', '', subject, flags=re.IGNORECASE)
        subject = re.sub(r'[\/]{2,}', '/', subject)
        subject = re.sub(r'\s+', ' ', subject).strip()

        # Clean course code: strip any extra suffixes like /14
        if course_code:
            course_code = re.sub(r'\s*/\d{1,2}\s*$', '', course_code)
            course_code = re.sub(r'\s+', ' ', course_code).strip()
        
        return subject, course_code

    def extract_teacher_info(self, text: str) -> Tuple[str, str]:
        """Extract teacher name and SAP ID."""
        
        # Try each teacher pattern
        for pattern in self.teacher_patterns:
            match = pattern.search(text)
            if match:
                if len(match.groups()) == 2:
                    name = match.group(1).strip()
                    sap_id = match.group(2)
                    # If multiple teachers are listed, take the first
                    primary_name = re.split(r'\s*[,&/]\s*', name)[0]
                    # Remove trailing inline room markers if present
                    primary_name = re.sub(r'\s*Room\b.*$', '', primary_name, flags=re.IGNORECASE).strip()
                    # Remove leading non-letter punctuation
                    primary_name = re.sub(r'^[^A-Za-z]+', '', primary_name)
                    return re.sub(r'\s+', ' ', primary_name), sap_id
                else:
                    name = match.group(1).strip()
                    primary_name = re.split(r'\s*[,&/]\s*', name)[0]
                    primary_name = re.sub(r'\s*Room\b.*$', '', primary_name, flags=re.IGNORECASE).strip()
                    primary_name = re.sub(r'^[^A-Za-z]+', '', primary_name)
                    return re.sub(r'\s+', ' ', primary_name), ""
        
        # Fallback: look for teacher after program patterns
        program_matches = []
        for pattern in self.program_patterns:
            for match in pattern.finditer(text):
                program_matches.append(match)
        
        if program_matches:
            # Get text after the last program match
            last_match = max(program_matches, key=lambda m: m.end())
            after_program = text[last_match.end():].strip()
            
            if after_program:
                # Try to extract SAP ID from the end
                sap_match = re.search(r'(\d{4,6})\s*$', after_program)
                if sap_match:
                    sap_id = sap_match.group(1)
                    name_part = after_program[:sap_match.start()].strip()
                    if name_part:
                        primary_name = re.split(r'\s*[,&/]\s*', name_part)[0]
                        primary_name = re.sub(r'\s*Room\b.*$', '', primary_name, flags=re.IGNORECASE).strip()
                        primary_name = re.sub(r'^[^A-Za-z]+', '', primary_name)
                        return re.sub(r'\s+', ' ', primary_name), sap_id
                else:
                    # Just name, no SAP ID
                    clean_name = re.sub(r'\s+', ' ', after_program).strip()
                    clean_name = re.sub(r'\s*Room\b.*$', '', clean_name, flags=re.IGNORECASE).strip()
                    clean_name = re.sub(r'^[^A-Za-z]+', '', clean_name)
                    if clean_name and len(clean_name) > 2:
                        primary_name = re.split(r'\s*[,&/]\s*', clean_name)[0]
                        return primary_name, ""
        
        return "", ""

    def convert_roman_to_numeric(self, roman: str) -> str:
        """Convert Roman numerals to numeric."""
        if not roman:
            return ""
        
        roman_upper = roman.upper().strip()
        if roman_upper.isdigit():
            return roman_upper
        
        return self.roman_numerals.get(roman_upper, roman)

    def is_reserved_cell(self, content: str) -> bool:
        """Check if cell should be skipped as reserved.
        Only skip when the cell is purely a reserved marker and does not contain
        any class/program/course information.
        """
        if not content or not content.strip():
            return True

        text = content.strip()
        # If it contains program or course code, it is not a pure reserved cell
        has_program = any(p.search(text) for p in self.program_patterns)
        has_course = any(c.search(text) for c in self.course_code_patterns)
        if has_program or has_course:
            return False

        return bool(self.reserved_regex.search(text))


# Utility function for Flask integration
def parse_csv_content(file_content: str) -> List[Dict[str, str]]:
    """Parse CSV content using the advanced parser."""
    parser = AdvancedTimetableParser()
    return parser.parse_csv_file(file_content)