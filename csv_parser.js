const fs = require('fs');

class AdvancedTimetableParser {
    constructor() {
        this.department_pattern = /^([A-Z][A-Za-z\s&/()\-']{2,120}?)\s*(?:-\s*)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i;
        this.time_slot_pattern = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/;
        this.capacity_pattern = /S\.?C\.?\s*:\s*(\d+)/i;
        this.sap_room_pattern = /([A-Z]-[A-Z0-9\-]+)/;

        this.course_code_patterns = [
            /\b([A-Z]+)\s*[-]?\s*(\d{3,5})\s*\/\s*([A-Z]+)?\s*(\d{3,5})\b/,
            /\(([A-Z]+)\s*(\d{3,5})\s*\/\s*([A-Z]+)?\s*(\d{3,5})\)/,
            /\b([A-Z]+)\.(\d{3,5})(?:\|\d{1,2})?\b/,
            /\b([A-Z]+)\s*[-]?\s*(\d{3,5})(?:\/\d{1,2})?\b/,
            /\(([A-Z]+)\s*(\d{3,5})(?:\/\d{1,2})?\)/,
            /\(([A-Z]+)(\d{3,5})(?:\/\d{1,2})?\)/,
            /\b([A-Z]+)\s*[-]\s*(\d{3,5})\b/,
            /\b([A-Z][A-Z0-9]{1,})\s*[\.-]+\s*(\d{3,5})(?:\|\d{1,2})?\b/,
            /\b([A-Z][A-Z0-9]{1,})\s*[-]?\s*(\d{3,5})(?:\/\d{1,2})?\b/,
            /\(([A-Z][A-Z0-9]{1,})\s*[-]?\s*(\d{3,5})(?:\/\d{1,2})?\)/,
            /\(([A-Z][A-Z0-9]{1,})(\d{3,5})(?:\/\d{1,2})?\)/,
            /\b([A-Z]{2,})(\d{3,5})(?=\D|$)/
        ];

        this.program_patterns = [
            /(BSCS|BSSE|BSAI)\s*[-\/]?\s*([IVX]+|\d+)\s*(?:-?\s*([A-Z]))?(?![a-z])/,
            /(BSCS)[-]?(\d+)([A-Z])(?![a-z])/,
            /(BSSE)[-]?(\d+)([A-Z])(?![a-z])/,
            /(BSAI)[-]?(\d+)([A-Z])(?![a-z])/,
            /(BSCS)[-]?(\d+)(?![A-Za-z])/,
            /(BSSE)[-]?(\d+)(?![A-Za-z])/,
            /(BSAI)[-]?(\d+)(?![A-Za-z])/,
            /(Pharm-?D)\s+([IVX]+)\s*(?:-\s*([A-Z]))?/,
            /(PharmD)\s+([IVX]+)(?![A-Za-z])/,
            /(BBA)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /(BBA2Y)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /(BBA2Y)[-]?(\d+)([A-Z]?)(?![a-z])/,
            /(BSAF)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /(BSAF2Y)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /(BSAF2Y)[-]?(\d+)([A-Z]?)(?![a-z])/,
            /(BSDM)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /(BSFT)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /(BS)\s+(\d+)([A-Z]?)(?![a-z])/,
            /(BS)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /(BS)\s*[-]?\s*([IVX]+)\s*([A-Z]?)(?![a-z])/,
            /(B\.?S)\s*[-]?\s*([IVX]+|\d+)\s*([A-Z]?)(?![a-z])/i,
            /\b(DPT)\b[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /\b(RIT)\b[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /\b(HND)\b[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /\b(MLT)\b[-]?([IVX]+)([A-Z]?)(?![a-z])/,
            /\b(RIT)\b[-]?(\d+(?:ST|ND|RD|TH)?)([A-Z]?)(?![a-z])/i,
            /\b(HND)\b[-]?(\d+(?:ST|ND|RD|TH)?)([A-Z]?)(?![a-z])/i,
            /\b(MLT)\b[-]?(\d+(?:ST|ND|RD|TH)?)([A-Z]?)(?![a-z])/i,
            /(BS)\s+(Biotech|Biotechnology|Zoology|Urdu|English|ENG|Mathematics|Math|MATH|MATHS|Physics|Psychology|Criminology|Chemistry|Mathematics\s+For\s+Data\s+Science|Nursing|IR|SISS|SSISS)\b\s*(?:[-/]?\s*([IVX]+|\d+))?\s*(?:-\s*([A-Z]))?/i,
            /(B\.?Ed(?:u)?)\s*[-/]?\s*([IVX]+|\d+)\b/i,
            /(BS)\s+(\d+)\s*([A-Z])\b/
        ];

        this.teacher_patterns = [
            /\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z][A-Za-z\s\.]*[A-Za-z]).*?SAP\s*ID\s*[:#-]?\s*(\d{4,6})\b/i,
            /\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z][A-Za-z\s\.]*[A-Za-z]).*?[\/]\s*(\d{4,6})\b/i,
            /\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*(\d{4,6})\b/i,
            /\b([A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*\((?:SAP\s*)?(\d{4,6})\)\s*(?=\s*(?:Room\b|$))/i,
            /\b([A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*(\d{4,6})\s*(?=\s*(?:Room\b|$))/i,
            /\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z][A-Za-z\s\.]*[A-Za-z])\b(?=\s*(?:Room\b|$))/i,
            /\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z\s\.]+[A-Za-z])\s*(\d{4,6})\s*$/i,
            /\b([A-Za-z][A-Za-z\s\.]+[A-Za-z])\s*\((\d{4,6})\)\s*$/i,
            /\b([A-Za-z][A-Za-z\s\.]+[A-Za-z])\s*(\d{4,6})\s*$/i,
            /\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)\s+[A-Za-z\s\.]+[A-Za-z])\s*$/i,
            /\b([A-Za-z][A-Za-z\s\.]{2,}[A-Za-z])\s*$/i,
            /\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]*[A-Za-z][A-Za-z\s\.]*[A-Za-z])\b/i
        ];

        this.roman_numerals = {
            'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
            'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10'
        };

        const reserved_pattern_strings = [
            '^\\s*reserved\\s*$',
            '^\\s*cs\\s*reserved\\s*$',
            '^\\s*math\\s*reserved\\s*$',
            '^\\s*dms\\s*reserved\\s*$',
            '^\\s*slot\\s*used\\s*$',
            '.*\\bslot\\s*used\\b.*',
            '^\\s*new\\s*hiring\\s*$',
            '^\\s*new\\s*appointment\\s*$',
            '.*\\bshifted\\b.*',
            '.*\\bmoved\\b.*',
            '.*\\bcancelled\\b.*',
            '.*\\bcanceled\\b.*',
            '.*\\bnew\\s*hiring\\b.*',
            '.*\\bnew\\s*appointment\\b.*'
        ];
        this.reserved_regex = new RegExp(reserved_pattern_strings.join('|'), 'i');

        this.allowed_departments = new Set();
        this.allowed_subdepts_by_dept = {};
        this._allowed_norm_subdepts = {};
        this.validation_log = [];

        this.DEPT_SUBDEPT = {
            "CS & IT": new Set(["Computer Science", "Software Engineering", "Artificial Intelligence", "CS & IT General"]),
            "LAHORE BUSINESS SCHOOL": new Set(["Business Administration", "Business Administration (2Y)", "Accounting & Finance", "Accounting & Finance (2Y)", "Digital Marketing", "Financial Technology", "Business General"]),
            "ENGLISH": new Set(["English", "English Literature", "English General"]),
            "ZOOLOGY": new Set(["Zoology", "Zoology General"]),
            "CHEMISTRY": new Set(["Chemistry", "Chemistry General"]),
            "MATHEMATICS": new Set(["Mathematics", "Mathematics General"]),
            "PHYSICS": new Set(["Physics", "Physics General"]),
            "PSYCHOLOGY": new Set(["Psychology", "Psychology General"]),
            "BIO TECHNOLOGY": new Set(["Biotechnology", "Biotechnology General"]),
            "DPT": new Set(["Doctor of Physical Therapy"]),
            "Radiology and Imaging Technology/Medical Lab Technology": new Set(["Radiology & Imaging Technology", "Medical Lab Technology", "Medical Technology General"]),
            "Human Nutrition and Dietetics": new Set(["Human Nutrition & Dietetics"]),
            "School of Nursing": new Set(["Nursing"]),
            "PHARM-D": new Set(["Pharmacy"]),
            "EDUCATION": new Set(["Education"]),
            "SSISS": new Set(["Social Sciences", "Criminology", "International Relations"]),
            "URDU": new Set(["Urdu", "Urdu Literature"]),
            "ISLAMIC STUDY": new Set(["Islamic Studies"])
        };

        this.SPEC_TO_DEPT = {
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
        };

        this.PROGRAM_TO_DEPT = {
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
        };
    }

    parseCSVString(str) {
        const rows = [];
        let row = [];
        let val = '';
        let inQuote = false;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const nextChar = str[i + 1];

            if (char === '"') {
                if (inQuote && nextChar === '"') {
                    val += '"';
                    i++;
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                row.push(val);
                val = '';
            } else if ((char === '\r' || char === '\n') && !inQuote) {
                if (char === '\r' && nextChar === '\n') i++;
                row.push(val);
                rows.push(row);
                row = [];
                val = '';
            } else {
                val += char;
            }
        }
        if (row.length > 0 || val.length > 0) {
            row.push(val);
            rows.push(row);
        }
        return rows;
    }

    parse_csv_file(file_content) {
        try {
            const rows = this.parseCSVString(file_content);
            const parsed_entries = [];
            let current_department = null;
            let current_day = null;
            let current_time_slots = [];
            this.raw_grid = rows;

            this._build_allowed_index(rows);

            let i = 0;
            while (i < rows.length) {
                const row = rows[i];
                if (!row || row.every(cell => cell.trim() === '')) {
                    i++;
                    continue;
                }

                const dept_match = this.department_pattern.exec(row[0]);
                if (dept_match) {
                    current_department = this._normalize_department_name(dept_match[1]);
                    current_day = dept_match[2];
                    current_time_slots = [];
                    i++;
                    continue;
                }

                if (current_department && current_time_slots.length === 0) {
                    const time_slots = this.extract_time_slots(row);
                    if (time_slots.length > 0) {
                        current_time_slots = time_slots;
                        i++;
                        continue;
                    }
                }

                if (current_department && current_time_slots.length > 0 && row.length > 0) {
                    const room_name = row[0].trim();
                    if (/Room\s*\/\s*Labs/i.test(room_name)) {
                        i++;
                        continue;
                    }

                    const room_capacity = this.extract_capacity(room_name);
                    const sap_room_id = this.extract_sap_room_id(room_name);

                    const entries = this.process_room_row_advanced(
                        row, i, current_department, current_day,
                        current_time_slots, room_name, room_capacity, sap_room_id
                    );
                    parsed_entries.push(...entries);
                }

                i++;
            }

            const final_entries = this.post_process_entries(parsed_entries);
            return final_entries;
        } catch (e) {
            console.error(`Error parsing CSV file: ${e}`);
            throw new Error(`CSV parsing failed: ${e}`);
        }
    }

    _norm(s) {
        return (s || '').trim().toLowerCase().replace('&', 'and').replace(/\s+/g, ' ');
    }

    _build_allowed_index(rows) {
        this.allowed_departments.clear();
        this.allowed_subdepts_by_dept = {};
        this._allowed_norm_subdepts = {};
        let current_department = null;
        for (const row of rows) {
            const dept_match = this.department_pattern.exec(row[0]);
            if (dept_match) {
                current_department = this._normalize_department_name(dept_match[1]);
                this.allowed_departments.add(current_department);
                continue;
            }
            if (!current_department) {
                continue;
            }
            for (let j = 1; j < row.length; j++) {
                const cell = row[j];
                if (!cell) continue;
                const text = cell.split('\n').map(line => line.trim()).filter(line => line).join(' ');
                const globals_list = this._extract_global_programs(text);
                if (globals_list.length > 0) {
                    for (const [p, s, sec] of globals_list) {
                        if (this._program_belongs_to_department(p, current_department)) {
                            const sd = this.get_sub_department(current_department, p);
                            if (sd && !('general' === sd.toLowerCase() && !/\bgeneral\b/i.test(text))) {
                                if (!this.allowed_subdepts_by_dept[current_department]) this.allowed_subdepts_by_dept[current_department] = new Set();
                                this.allowed_subdepts_by_dept[current_department].add(sd);

                                const norm_dept = this._norm(current_department);
                                if (!this._allowed_norm_subdepts[norm_dept]) this._allowed_norm_subdepts[norm_dept] = new Set();
                                this._allowed_norm_subdepts[norm_dept].add(this._norm(sd));
                            }
                        }
                    }
                } else {
                    if (/\bgeneral\b/i.test(text)) {
                        const cand = this.get_sub_department(current_department, '');
                        if (cand && cand.toLowerCase().includes('general')) {
                            if (!this.allowed_subdepts_by_dept[current_department]) this.allowed_subdepts_by_dept[current_department] = new Set();
                            this.allowed_subdepts_by_dept[current_department].add(cand);

                            const norm_dept = this._norm(current_department);
                            if (!this._allowed_norm_subdepts[norm_dept]) this._allowed_norm_subdepts[norm_dept] = new Set();
                            this._allowed_norm_subdepts[norm_dept].add(this._norm(cand));
                        }
                    }
                }
            }
        }
    }

    _program_belongs_to_department(program, department) {
        const p = (program || '').trim();
        const d = this._normalize_department_name(department);
        if (!p) return true;
        const pu = p.toUpperCase();
        if (pu === 'BS') return true;
        if (pu.startsWith('BS ')) {
            let spec = pu.substring(3).trim();
            if (!/[A-Za-z]/.test(spec)) return true;
            const map = { 'ENG': 'ENGLISH', 'EDU': 'EDUCATION', 'MATH': 'MATHEMATICS', 'MATHS': 'MATHEMATICS' };
            spec = map[spec] || spec;
            const owner = this.SPEC_TO_DEPT[spec] || null;
            return owner === d;
        }
        const owner = this.PROGRAM_TO_DEPT[pu] || null;
        return owner === d;
    }

    _validate_subdept(department, subdept, program) {
        if (!subdept) return '';
        const key = this._norm(this._normalize_department_name(department));
        const sdn = this._norm(subdept);
        if (sdn.endsWith('general') && (!this._allowed_norm_subdepts[key] || !this._allowed_norm_subdepts[key].has(sdn))) {
            console.warn(`Rejected general sub_department '${subdept}' for department '${department}'`);
            this.validation_log.push({ 'department': department, 'program': program, 'reason': 'general_not_allowed' });
            return '';
        }
        if (this._allowed_norm_subdepts[key] && !this._allowed_norm_subdepts[key].has(sdn)) {
            console.warn(`Rejected sub_department '${subdept}' for department '${department}' not present in CSV`);
            this.validation_log.push({ 'department': department, 'program': program, 'reason': 'subdept_not_in_csv' });
            return '';
        }
        return subdept;
    }

    process_room_row_advanced(row, row_index, department, day, time_slots, room_name, room_capacity, sap_room_id) {
        const entries = [];
        const has_room_header = this.is_valid_room_header(room_name);
        if (!has_room_header) {
            room_name = "Unknown/TBD";
        }
        for (let col_idx = 1; col_idx < Math.min(row.length, time_slots.length + 1); col_idx++) {
            if (col_idx >= row.length) break;
            const cell_content = row[col_idx].trim();
            if (!cell_content) continue;
            const extended_content = this.get_extended_cell_content(row_index, col_idx, cell_content);
            const class_entries = this.parse_class_entry_comprehensive(
                extended_content, department, day, time_slots[col_idx - 1],
                room_name, room_capacity, sap_room_id, has_room_header
            );
            entries.push(...class_entries);
        }
        return entries;
    }

    get_extended_cell_content(row_index, col_index, base_content) {
        return base_content;
    }

    create_class_entry(content, department, day, time_slot, room_name, room_capacity, sap_room_id, program, semester, section, has_room_header = true) {
        const [subject, course_code] = this.extract_subject_and_course_code(content);
        const [teacher_name, teacher_sap_id] = this.extract_teacher_info(content, section);
        const inline_room = this.extract_inline_room(content);
        room_name = this.resolve_room_name(room_name, inline_room, has_room_header, content, department);
        room_name = room_name.replace(/\s+/g, ' ').trim();
        program = program.replace(/\bB\.?S\b/g, 'BS').trim();
        let sub_department = this.get_sub_department(department, program);
        sub_department = this._validate_subdept(department, sub_department, program);
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
        };
    }

    create_class_entry_direct(subject, course_code, department, day, time_slot, room_name, room_capacity, sap_room_id, program, semester, section, teacher_name, teacher_sap_id, raw_text, has_room_header = true) {
        const inline_room = this.extract_inline_room(raw_text);
        room_name = this.resolve_room_name(room_name, inline_room, has_room_header, raw_text, department);
        room_name = room_name.replace(/\s+/g, ' ').trim();
        program = program.replace(/\bB\.?S\b/g, 'BS').trim();
        let sub_department = this.get_sub_department(department, program);
        sub_department = this._validate_subdept(department, sub_department, program);
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
        };
    }

    parse_class_entry_comprehensive(cell_content, department, day, time_slot, room_name, room_capacity, sap_room_id, has_room_header = true) {
        if (!cell_content) return [];
        if (this.is_reserved_cell(cell_content)) {
            let content = cell_content.split('\n').map(line => line.trim()).filter(line => line).join(' ');
            content = this.normalize_text_for_raw(content);
            return [this.create_class_entry(content, department, day, time_slot,
                room_name, room_capacity, sap_room_id,
                '', '', '', has_room_header)];
        }
        let content = cell_content.split('\n').map(line => line.trim()).filter(line => line).join(' ');
        content = this.normalize_text_for_raw(content);
        if (/^\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*$/.test(content)) {
            return [];
        }
        const [subj0, _] = this.extract_subject_and_course_code(content);
        if (this._is_program_metadata_segment(content, subj0)) {
            return [];
        }
        const globals_list_early = this._extract_global_programs(content);
        if (globals_list_early && globals_list_early.length > 1) {
            const [subj_preview, _cc_preview] = this.extract_subject_and_course_code(content);
            if (!this._is_program_metadata_segment(content, subj_preview)) {
                const dept_norm = this._normalize_department_name(department);
                const owned = globals_list_early.filter(t => this._program_belongs_to_department(t[0], dept_norm));
                const chosen_list = owned.length > 0 ? owned : globals_list_early;
                const out = [];
                const seen = new Set();
                for (const [pp, ss, sc] of chosen_list) {
                    const key = `${pp || ''}|${ss || ''}|${sc || ''}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const e = this.create_class_entry(
                        content, department, day, time_slot,
                        room_name, room_capacity, sap_room_id,
                        pp, ss, sc, has_room_header
                    );
                    e['is_merged_class'] = 'true';
                    e['merged_programs'] = globals_list_early.map(([p, s, sec]) => ({
                        'program': p,
                        'semester': s,
                        'section': sec
                    }));
                    out.push(e);
                }
                return out;
            }
        }

        const multi_pairs = [];
        const mp_regex = /\s*([^()]+?)\s*\(\s*((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)+\s+(?:[A-Z][a-z]+|[A-Z]\.)+(?:\s+(?:[A-Z][a-z]+|[A-Z]\.)){0,3})\s*\)/g;
        let mp_match;
        while ((mp_match = mp_regex.exec(content)) !== null) {
            multi_pairs.push(mp_match);
        }

        if (multi_pairs.length >= 2) {
            let entries = [];
            const inferred_program = this.infer_program_from_context(department, content);
            for (const m of multi_pairs) {
                const subj_raw = m[1].trim();
                const teacher_raw = m[2].trim();
                const subj_clean = subj_raw.replace(/\s*[,&/]+\s*$/, "");
                const [cc_subject, cc_code] = this.extract_subject_and_course_code(subj_clean);
                const [sem, sec] = this.extract_semester_section_from_any(subj_clean);
                const entry = this.create_class_entry_direct(
                    cc_subject, cc_code, department, day, time_slot,
                    room_name, room_capacity, sap_room_id,
                    inferred_program, sem, sec,
                    this._cleanup_name_tail(teacher_raw), "",
                    `${subj_clean} (${teacher_raw})`, has_room_header
                );
                entries.push(entry);
            }
            entries = this._assign_programs_to_entries(entries, content);
            return entries;
        }

        const teacher_any = [];
        const ta_regex = /((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]+(?:[A-Z][a-z]+|[A-Z]\.)+(?:\s+(?:[A-Z][a-z]+|[A-Z]\.)){0,3})/g;
        let ta_match;
        while ((ta_match = ta_regex.exec(content)) !== null) {
            teacher_any.push(ta_match);
        }

        if (teacher_any.length >= 2) {
            let entries = [];
            let start_prev = 0;
            for (let idx = 0; idx < teacher_any.length; idx++) {
                const tm = teacher_any[idx];
                let end = tm.index + tm[0].length;
                const post = content.substring(end);
                const m_id = /^\s*\(?\s*(\d{4,6})\s*\)?/.exec(post);
                if (m_id) {
                    end += m_id[0].length;
                }
                let segment = content.substring(start_prev, end).trim();
                segment = segment.replace(/^\s*,\s*/, '');
                const [subj, code] = this.extract_subject_and_course_code(segment);
                if (this._is_program_metadata_segment(segment, subj)) {
                    start_prev = end;
                    continue;
                }
                const prog = this.infer_program_from_context(department, segment);
                const [sem3, sec3] = this.extract_semester_section_from_any(segment);
                let teacher_name = tm[1].trim();
                teacher_name = this._cap_teacher_tokens(this._cleanup_name_tail(teacher_name));
                const entry = this.create_class_entry_direct(
                    subj, code, department, day, time_slot,
                    room_name, room_capacity, sap_room_id,
                    prog, sem3, sec3,
                    teacher_name, m_id ? m_id[1] : "",
                    segment, has_room_header
                );
                entries.push(entry);
                start_prev = end;
            }
            entries = this._assign_programs_to_entries(entries, content);
            return entries;
        }

        const code_pairs = [];
        const cp_regex = /([^()]+?)\(([A-Za-z][^)]*?\d[^)]*?)\)/g;
        let cp_match;
        while ((cp_match = cp_regex.exec(content)) !== null) {
            code_pairs.push(cp_match);
        }

        if (code_pairs.length >= 2) {
            let entries = [];
            for (let idx = 0; idx < code_pairs.length; idx++) {
                const m = code_pairs[idx];
                const start = m.index;
                const end = (idx + 1 < code_pairs.length) ? code_pairs[idx + 1].index : content.length;
                let segment = content.substring(start, end).trim();
                segment = segment.replace(/^\s*,\s*/, '');
                segment = this.normalize_text_for_raw(segment);
                let program = "", semester = "", section = "";
                for (const pattern of this.program_patterns) {
                    const ms = pattern.exec(segment);
                    if (ms) {
                        program = ms[1];
                        if (program.toLowerCase() === 'bs' && ms.length >= 3 && typeof ms[2] === 'string') {
                            const spec = ms[2].trim();
                            const semester_raw = ms.length > 2 ? ms[3] : "";
                            section = ms.length > 3 ? ms[4] : "";
                            program = `BS ${spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase()}`;
                        } else {
                            const semester_raw = ms[2];
                            section = ms.length > 2 ? ms[3] : "";
                            semester = (typeof semester_raw === 'string' && /^[A-Za-z]+$/.test(semester_raw)) ? this.convert_roman_to_numeric(semester_raw) : semester_raw;
                        }
                        if (!semester && typeof semester_raw !== 'undefined') {
                            semester = (typeof semester_raw === 'string' && /^[A-Za-z]+$/.test(semester_raw)) ? this.convert_roman_to_numeric(semester_raw) : semester_raw;
                        }
                        break;
                    }
                }
                if (!program) {
                    program = this.infer_program_from_context(department, segment);
                    const [sem2, sec2] = this.extract_semester_section_from_any(segment);
                    if (sem2) semester = sem2;
                    if (sec2) section = sec2;
                }
                const [subj_preview, _cc_preview] = this.extract_subject_and_course_code(segment);
                if (this._is_program_metadata_segment(segment, subj_preview)) {
                    continue;
                }
                const gl = this._extract_global_programs(segment);
                if (gl && gl.length > 1) {
                    for (const [p_g, s_g, sec_g] of gl) {
                        entries.push(this.create_class_entry(
                            segment, department, day, time_slot,
                            room_name, room_capacity, sap_room_id,
                            p_g, s_g, sec_g, has_room_header
                        ));
                    }
                } else {
                    const entry = this.create_class_entry(
                        segment, department, day, time_slot,
                        room_name, room_capacity, sap_room_id,
                        program, semester, section, has_room_header
                    );
                    entries.push(entry);
                }
            }
            const t_any = [];
            const t_any_regex_js = /((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]*(?:[A-Z][a-z]+|[A-Z]\.)+(?:\s+(?:[A-Z][a-z]+|[A-Z]\.)){0,3})/g;
            let t_match;
            while ((t_match = t_any_regex_js.exec(content)) !== null) {
                t_any.push(t_match);
            }

            if (t_any.length >= 1) {
                const tname = this._cap_teacher_tokens(this._cleanup_name_tail(t_any[0][1].trim()));
                for (const e of entries) {
                    if (!e['teacher_name']) {
                        e['teacher_name'] = tname;
                    }
                }
            } else if (entries.length >= 2) {
                let [tname2, _sap2] = this.extract_teacher_info(content);
                if (tname2) {
                    tname2 = this._cleanup_name_tail(tname2);
                    for (const e of entries) {
                        if (!e['teacher_name']) {
                            e['teacher_name'] = tname2;
                        }
                    }
                }
            }
            entries = this._assign_programs_to_entries(entries, content);
            return entries;
        }

        const all_program_matches = [];
        for (const pattern of this.program_patterns) {
            const globalPattern = new RegExp(pattern.source, pattern.flags + (pattern.flags.includes('g') ? '' : 'g'));
            let match;
            while ((match = globalPattern.exec(content)) !== null) {
                if (match.length >= 2) {
                    let program = match[1];
                    let semester = "", section = "";
                    if (program.toLowerCase() === 'bs' && match.length >= 3 && typeof match[2] === 'string') {
                        const spec = match[2].trim();
                        const sem_raw = match.length > 2 ? match[3] : "";
                        const sec = match.length > 3 ? match[4] : "";
                        semester = (sem_raw && typeof sem_raw === 'string' && /^[A-Za-z]+$/.test(sem_raw)) ? this.convert_roman_to_numeric(sem_raw) : (sem_raw || '');
                        const prog_name = `BS ${spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase()}`;
                        all_program_matches.push([prog_name, semester, sec]);
                        continue;
                    }
                    const semester_raw = match[2];
                    section = match.length > 2 ? match[3] : "";
                    semester = (typeof semester_raw === 'string' && /^[A-Za-z]+$/.test(semester_raw)) ? this.convert_roman_to_numeric(semester_raw) : semester_raw;
                    all_program_matches.push([program, semester, section]);
                }
            }
        }

        let inferred_program = this.infer_program_from_context(department, content);
        let [sem, sec] = this.extract_semester_section_from_any(content);
        const globals_list = this._extract_global_programs(content);
        if (globals_list && globals_list.length > 0) {
            if (globals_list.length > 1) {
                const [subj_preview, _cc_preview] = this.extract_subject_and_course_code(content);
                if (!this._is_program_metadata_segment(content, subj_preview)) {
                    const dept_norm = this._normalize_department_name(department);
                    const owned = globals_list.filter(t => this._program_belongs_to_department(t[0], dept_norm));
                    const chosen_list2 = owned.length > 0 ? owned : globals_list;
                    const out2 = [];
                    const seen2 = new Set();
                    for (const [pp2, ss2, sc2] of chosen_list2) {
                        const key2 = `${pp2 || ''}|${ss2 || ''}|${sc2 || ''}`;
                        if (seen2.has(key2)) continue;
                        seen2.add(key2);
                        const e2 = this.create_class_entry(
                            content, department, day, time_slot,
                            room_name, room_capacity, sap_room_id,
                            pp2, ss2, sc2
                        );
                        e2['is_merged_class'] = 'true';
                        e2['merged_programs'] = globals_list.map(([p, s, sec]) => ({
                            'program': p,
                            'semester': s,
                            'section': sec
                        }));
                        out2.push(e2);
                    }
                    return out2;
                }
            } else {
                const chosen2 = globals_list.find(t => t[0].startsWith('BS ') && t[0] !== 'BS') || globals_list[0];
                const [program, semester, section] = chosen2;
                inferred_program = program || inferred_program;
                sem = semester || sem;
                sec = section || sec;
            }
        } else if (all_program_matches.length > 0) {
            const [program, semester, section] = all_program_matches[0];
            inferred_program = program || inferred_program;
            sem = semester || sem;
            sec = section || sec;
        }
        return [this.create_class_entry(content, department, day, time_slot,
            room_name, room_capacity, sap_room_id,
            inferred_program, sem, sec, has_room_header)];
    }

    resolve_room_name(header_room, inline_room, has_room_header, content_text = "", department = "") {
        if (has_room_header) {
            let out = inline_room || header_room;
            out = out.replace(/Room#/g, 'Room ').replace(/Lab#/g, 'Lab ');
            return out;
        }
        const t = content_text || "";
        const patterns = [
            [/\bRoom\s*no\.?\s*(\d+)\b/i, 'Room {}'],
            [/\bRoom\s*#\s*(\d+)\b/i, 'Room#{}'],
            [/\bRoom\s*[#:]?\s*([A-Z0-9\-/]+)\b/i, 'Room {}'],
            [/\bLab\s*#\s*(\d+)\b/i, 'Lab#{}'],
            [/\bLab\s*[#:]?\s*([A-Z0-9\-/]+)\b/i, 'Lab {}']
        ];
        for (const [pat, fmt] of patterns) {
            const m = pat.exec(t);
            if (m) {
                const idx = m.index;
                // Check if inside parentheses
                const before = t.substring(0, idx);
                const openParen = (before.match(/\(/g) || []).length;
                const closeParen = (before.match(/\)/g) || []).length;
                const inside_paren = openParen > closeParen;

                const deptUpper = department.toUpperCase();
                const allowedDepts = new Set(['EDUCATION', 'PSYCHOLOGY', 'SSISS', 'SISS', 'BIO TECHNOLOGY', 'BIOTECH', 'BIOTECHNOLOGY', 'URDU']);

                if (!inside_paren || allowedDepts.has(deptUpper)) {
                    let out = fmt.replace('{}', m[1]);
                    out = out.replace(/Room#/g, 'Room ').replace(/Lab#/g, 'Lab ');
                    return out;
                }
            }
        }
        const m5 = /\(\s*(?:Room\s*)?(\d{2,4})\)\s*$/i.exec(t);
        const deptUpper = department.toUpperCase();
        const allowedDepts = new Set(['EDUCATION', 'PSYCHOLOGY', 'SSISS', 'SISS', 'BIO TECHNOLOGY', 'BIOTECH', 'BIOTECHNOLOGY', 'URDU']);
        if (m5 && allowedDepts.has(deptUpper)) {
            let out = `Room ${m5[1]}`;
            out = out.replace(/Room#/g, 'Room ').replace(/Lab#/g, 'Lab ');
            return out;
        }
        return (header_room && header_room.replace(/#/g, ' ')) || "Unknown/TBD";
    }

    is_valid_room_header(room_text) {
        const t = (room_text || '').trim();
        if (!t) return false;
        if (this.capacity_pattern.test(t) || this.sap_room_pattern.test(t)) return true;
        if (/^\d{2,}\b/.test(t)) return true;
        if (/\bLab\b/i.test(t)) return true;
        return false;
    }

    extract_inline_room(text) {
        let m = /Room\s*#\s*(\d+)/i.exec(text);
        if (m) return `Room#${m[1]}`;
        let m0 = /\bRoom\s*no\.?\s*(\d+)\b/i.exec(text);
        if (m0) return `Room ${m0[1]}`;
        let m2 = /\bRoom\s*[#:]?\s*([A-Z0-9\-/]+)/i.exec(text);
        if (m2) return `Room ${m2[1]}`;
        let m3 = /Lab\s*#\s*(\d+)/i.exec(text);
        if (m3) return `Lab#${m3[1]}`;
        let m4 = /\bLab\s*[#:]?\s*([A-Z0-9\-/]+)/i.exec(text);
        if (m4) return `Lab ${m4[1]}`;
        return "";
    }

    get_sub_department(department, program) {
        const dnorm = this._normalize_department_name(department);
        const p = (program || '').toUpperCase();
        if (p.startsWith('BS ')) {
            const spec = p.substring(3).trim();
            if (!/[A-Za-z]/.test(spec)) {
                // pass
            } else {
                const syn = {
                    'MATHS': 'Mathematics',
                    'MATH': 'Mathematics',
                    'ENG': 'English',
                    'EDU': 'Education',
                    'SSISS': 'SISS'
                };
                const specTitle = spec.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                const specFinal = syn[spec.toUpperCase()] || specTitle;

                if (this.DEPT_SUBDEPT[dnorm] && this.DEPT_SUBDEPT[dnorm].has(specFinal)) return specFinal;
                return '';
            }
        }
        if (p === "HND") return "Human Nutrition & Dietetics";
        if (p === "RIT") return "Radiology & Imaging Technology";
        if (p === "MLT") return "Medical Lab Technology";
        if (p === "DPT") return "Doctor of Physical Therapy";

        if (dnorm === "CS & IT") {
            if (program === "BSCS") return "Computer Science";
            else if (program === "BSSE") return "Software Engineering";
            else if (program === "BSAI") return "Artificial Intelligence";
            else return "CS & IT General";
        } else if (dnorm === "LAHORE BUSINESS SCHOOL") {
            if (program === "BBA2Y") return "Business Administration (2Y)";
            if (program === "BSAF2Y") return "Accounting & Finance (2Y)";
            if (program === "BBA") return "Business Administration";
            else if (program === "BSAF") return "Accounting & Finance";
            else if (program === "BSDM") return "Digital Marketing";
            else if (program === "BSFT") return "Financial Technology";
            else return "Business General";
        } else if (dnorm === "ENGLISH") {
            if (program === "BS") return "English";
            else return "English General";
        } else if (dnorm === "ZOOLOGY") {
            if (program.toUpperCase().startsWith("BS")) return "Zoology";
            else return "Zoology General";
        } else if (dnorm === "CHEMISTRY") {
            if (program.toUpperCase().startsWith("BS")) return "Chemistry";
            else return "Chemistry General";
        } else if (dnorm === "MATHEMATICS") {
            if (program.toUpperCase().startsWith("BS")) return "Mathematics";
            else return "Mathematics General";
        } else if (dnorm === "PHYSICS") {
            if (program.toUpperCase().startsWith("BS")) return "Physics";
            else return "Physics General";
        } else if (dnorm === "PSYCHOLOGY") {
            if (program.toUpperCase().startsWith("BS")) return "Psychology";
            else return "Psychology General";
        } else if (dnorm === "BIO TECHNOLOGY") {
            if (program.toUpperCase().startsWith("BS")) return "Biotechnology";
            else return "Biotechnology General";
        } else if (dnorm === "DPT") {
            return "Doctor of Physical Therapy";
        } else if (dnorm === "Radiology and Imaging Technology/Medical Lab Technology") {
            if (program === "RIT") return "Radiology & Imaging Technology";
            else if (program === "MLT") return "Medical Lab Technology";
            else if (program === "HND") return "Human Nutrition & Dietetics";
            else return "Medical Technology General";
        } else if (dnorm === "School of Nursing") {
            return "Nursing";
        } else if (dnorm === "PHARM-D") {
            return "Pharmacy";
        } else if (dnorm === "EDUCATION") {
            return "Education";
        } else if (dnorm === "SSISS") {
            return "Social Sciences";
        } else if (dnorm === "URDU") {
            return "Urdu Literature";
        } else if (dnorm === "ISLAMIC STUDY") {
            return "Islamic Studies";
        } else if (dnorm === "Human Nutrition and Dietetics") {
            return "Human Nutrition & Dietetics";
        } else {
            return dnorm;
        }
    }

    _normalize_department_name(name) {
        let n = name.trim();
        n = n.replace(/^Human Nutrition and Dietetics\s*\([^)]+\)\s*$/i, 'Human Nutrition and Dietetics');
        n = n.replace(/\s+/g, ' ').trim();
        return n;
    }

    extract_subject_and_course_code(text) {
        let course_code = "";
        let subject = "";
        let course_code_match = null;
        let clean = text.replace(/\(([A-Z]{2,})\s*[-]{2,}\s*(\d{3,5})(?:\|\d+)?\)/g, '($1 $2)');
        clean = clean.replace(/\b([A-Z]{2,})\s*[-]{2,}\s*(\d{3,5})(?:\|\d+)?\b/g, '$1 $2');
        clean = clean.replace(/\(([A-Z]{2,})\s*[\-\s]*\s*(\d{3,5})(?:\|\d+)?\)/g, '($1 $2)');
        clean = clean.replace(/\b([A-Z]{2,})(\d{3,5})\s*\/\s*[A-Z]{2,}\d{3,5}\b/g, '$1 $2');
        clean = clean.replace(/\(([A-Z]{2,})(\d{3,5})\s*\/\s*[A-Z]{2,}\d{3,5}\)/g, '($1 $2)');
        let text2 = clean;

        if (/^\s*(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)(?:\b|\s)/.test(text2)) {
            const par = /\(([^\)]{3,})\)/.exec(text2);
            if (par) {
                text2 = par[1].trim();
            }
        }
        const ignore_prefixes = new Set(['ROOM', 'ROOM#', 'LAB', 'SAP']);
        for (const pattern of this.course_code_patterns) {
            const globalPattern = new RegExp(pattern.source, pattern.flags + (pattern.flags.includes('g') ? '' : 'g'));
            let m_loop;
            while ((m_loop = globalPattern.exec(text2)) !== null) {
                const prefix_loop = m_loop[1];
                if (prefix_loop && ignore_prefixes.has(prefix_loop.toUpperCase())) {
                    continue;
                }
                course_code_match = m_loop;
                if (m_loop.length === 5) {
                    const p1 = m_loop[1];
                    const n1 = m_loop[2];
                    const p2 = m_loop[3] || p1;
                    const n2 = m_loop[4];
                    course_code = `${p1} ${n1}/${p2}${n2}`;
                } else {
                    course_code = `${m_loop[1]} ${m_loop[2]}`;
                }
                break;
            }
            if (course_code_match) break;
        }

        if (course_code_match) {
            subject = text2.substring(0, course_code_match.index).trim();
            const after_code = text2.substring(course_code_match.index + course_code_match[0].length);
            if (/\b[lL]ab\b/.test(after_code)) {
                subject = (subject + ' Lab').trim();
            }
        } else {
            let program_match = null;
            for (const pattern of this.program_patterns) {
                const globalPattern = new RegExp(pattern.source, pattern.flags + (pattern.flags.includes('g') ? '' : 'g'));
                let match;
                while ((match = globalPattern.exec(text2)) !== null) {
                    if ((program_match === null) || (match.index < program_match.index)) {
                        program_match = match;
                    }
                }
            }
            if (program_match) {
                const cut_at = program_match.index;
                const paren_before = text2.lastIndexOf('(', cut_at);
                if (paren_before !== -1 && paren_before < cut_at) {
                    subject = text2.substring(0, paren_before).trim();
                } else {
                    subject = text2.substring(0, cut_at).trim();
                }
            } else {
                const bs_prog_like = /\bBS\s+[A-Za-z][A-Za-z\s&]+\s*(?:[-/]?\s*[IVX]+|\s*\d+)?\b/i.exec(text);
                if (bs_prog_like) {
                    const cut_at = bs_prog_like.index;
                    const paren_before = text2.lastIndexOf('(', cut_at);
                    if (paren_before !== -1 && paren_before < cut_at) {
                        subject = text2.substring(0, paren_before).trim();
                    } else {
                        subject = text2.substring(0, cut_at).trim();
                    }
                } else {
                    const tmatch = /\b(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)(?:\b|\s)/.exec(text2);
                    if (tmatch) {
                        if (tmatch.index <= 2) {
                            subject = text2.substring(tmatch.index + tmatch[0].length).trim();
                        } else {
                            subject = text2.substring(0, tmatch.index).trim();
                        }
                    } else {
                        subject = text2;
                    }
                }
            }
        }
        subject = subject.replace(/^\s*,\s*/, '');
        subject = subject.replace(/\bRoom\s*[#:]?\s*[A-Za-z0-9\-/]+/gi, '');
        subject = subject.replace(/\bLab\s*[#:]?\s*[A-Za-z0-9\-/]+/gi, '');
        subject = subject.replace(/\s*-\s*Lab\b.*$/i, '');
        subject = subject.replace(/[\/]{2,}/g, '/');
        subject = subject.replace(/\s*\((?:[^)]*\b(?:BS|B\.?Ed|English|ENG|Maths|Mathematics|Urdu|Zoology|Psychology|SISS|SSISS|Nursing|BBA|BSAF|BSCS|BSSE|BSAI|BSMDS)\b[^)]*)\)\s*$/i, '');
        subject = subject.replace(/\s*\(?\s*Semester\s*#?\s*(?:[IVX]+|\d+(?:st|nd|rd|th)?)\s*\)?\s*$/i, '');
        subject = subject.replace(/\s*\b(?:\d{1,2}(?:st|nd|rd|th))\s*sem(?:ester|ster)\b\s*$/i, '');
        subject = subject.replace(/^[\(\),;\/\-\s]+/, '');
        subject = subject.replace(/\($/, '').replace(/,$/, '').replace(/-$/, '').trim();
        subject = subject.replace(/\(\s*\)$/, '').trim();
        subject = subject.replace(/\s+/g, ' ').trim();
        subject = subject.replace(/\blab\b/i, 'Lab');
        subject = subject.replace(/\bAnaysis\b/i, 'Analysis');
        subject = subject.replace(/\bExcercises\b/i, 'Exercises');
        subject = subject.replace(/\bQuantitaive\b/i, 'Quantitative');
        subject = subject.replace(/\bDigitial\b/i, 'Digital');
        subject = subject.replace(/\bImplmentation\b/i, 'Implementation');
        if (course_code) {
            course_code = course_code.replace(/\s+/g, ' ').trim();
        }
        return [subject, course_code];
    }

    extract_teacher_info(text, section = "") {
        const program_matches = [];
        for (const pattern of this.program_patterns) {
            const globalPattern = new RegExp(pattern.source, pattern.flags + (pattern.flags.includes('g') ? '' : 'g'));
            let match;
            while ((match = globalPattern.exec(text)) !== null) {
                program_matches.push(match);
            }
        }
        if (program_matches.length > 0) {
            const last_match = program_matches.reduce((max, m) => (m.index + m[0].length > max.index + max[0].length) ? m : max, program_matches[0]);
            let end_pos;
            try {
                end_pos = last_match.index + last_match[0].length;
            } catch (e) {
                end_pos = last_match.index + last_match[0].length;
            }

            const after_program = text.substring(end_pos).trim();
            if (after_program) {
                const sap_paren = /\(\s*(\d{4,6})\s*\)/.exec(after_program);
                const sap_match = sap_paren || /(\d{4,6})/.exec(after_program);
                if (sap_match) {
                    const sap_id = sap_match[1];
                    let name_part = after_program.substring(0, sap_match.index).trim();
                    name_part = name_part.replace(/^\s*Room\b[\s#: -]*[A-Za-z0-9/\-]+\s*/i, '').trim();
                    if (name_part) {
                        let primary_name = name_part.split(/\s*[,&/]\s*/)[0];
                        primary_name = primary_name.replace(/^[^A-Za-z]+/, '');
                        primary_name = this._strip_leading_section_token(primary_name, text, section);
                        primary_name = this._strip_leading_program_token(primary_name);
                        primary_name = this._cleanup_name_tail(primary_name);
                        primary_name = this._normalize_teacher_title(this._cap_teacher_tokens(primary_name));
                        primary_name = primary_name.replace(/\s+(?:BS|BBA|BSAF|BSCS|BSSE|BSAI|Pharm-?D|DPT|RIT|HND)\b.*$/i, '');
                        primary_name = this._cleanup_name_tail(primary_name);
                        if (primary_name) {
                            return [primary_name.replace(/\s+/g, ' '), sap_id];
                        }
                    }
                } else {
                    let clean_name = after_program.replace(/\s+/g, ' ').trim();
                    clean_name = clean_name.replace(/^\s*Room\b[\s#: -]*[A-Za-z0-9/\-]+\s*/i, '').trim();
                    clean_name = clean_name.replace(/^[^A-Za-z]+/, '');
                    clean_name = this._strip_leading_section_token(clean_name, text, section);
                    clean_name = this._strip_leading_program_token(clean_name);
                    if (clean_name && clean_name.length > 2) {
                        let primary_name = clean_name.split(/\s*[,&/]\s*/)[0];
                        primary_name = this._cleanup_name_tail(primary_name);
                        primary_name = this._normalize_teacher_title(this._cap_teacher_tokens(primary_name));
                        primary_name = primary_name.replace(/\s+(?:BS|BBA|BSAF|BSCS|BSSE|BSAI|Pharm-?D|DPT|RIT|HND)\b.*$/i, '');
                        primary_name = this._cleanup_name_tail(primary_name);
                        if (!/\b(reserved|slot|department|used|class)\b/i.test(primary_name)) {
                            const upper = primary_name.trim().toUpperCase();
                            if (["URDU", "ENGLISH", "ENG", "MATH", "MATHEMATICS", "EDU", "EDUCATION", "IR", "SISS", "SSISS"].includes(upper)) {
                                // pass
                            } else if (/^(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)(?:\b|\s)/.test(primary_name) || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(primary_name)) {
                                return [primary_name, ""];
                            }
                        }
                    }
                }
            }
        }
        for (const pattern of this.teacher_patterns) {
            const match = pattern.exec(text);
            if (match) {
                if (match.length === 3) {
                    const name = match[1].trim();
                    let sap_id = match[2];
                    let primary_name = name.split(/\s*[,&/]\s*/)[0];
                    primary_name = primary_name.replace(/^\s*Room\b[\s#: -]*[A-Za-z0-9/\-]+\s*/i, '').trim();
                    primary_name = primary_name.replace(/^[^A-Za-z]+/, '');
                    primary_name = this._strip_leading_section_token(primary_name, text, section);
                    primary_name = this._strip_leading_program_token(primary_name);
                    primary_name = this._cleanup_name_tail(primary_name);
                    primary_name = this._normalize_teacher_title(this._cap_teacher_tokens(primary_name));
                    primary_name = primary_name.replace(/\s+(?:BS|BBA|BSAF|BSCS|BSSE|BSAI|Pharm-?D|DPT|RIT|HND)\b.*$/i, '');
                    primary_name = this._cleanup_name_tail(primary_name);
                    if (/^\s*(Bridging|merge\b|meerge\b)/i.test(primary_name) || primary_name.split(/\s+/).length <= 3) {
                        const mfull = /((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]+[A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*\(\s*(\d{4,6})\s*\)/i.exec(text);
                        if (mfull) {
                            let nm2 = mfull[1];
                            nm2 = this._cleanup_name_tail(nm2);
                            primary_name = this._normalize_teacher_title(this._cap_teacher_tokens(nm2));
                            primary_name = primary_name.replace(/^\s*(?:Bridging|merge\s+with\s+[A-Za-z/&\s]+|meerge\s+with\s+SIS)\s+/i, '');
                            sap_id = mfull[2];
                        }
                    }
                    if (/\b(reserved|slot|department|used|class)\b/i.test(primary_name)) continue;
                    return [primary_name.replace(/\s+/g, ' '), sap_id];
                } else {
                    const name = match[1].trim();
                    let primary_name = name.split(/\s*[,&/]\s*/)[0];
                    primary_name = primary_name.replace(/^\s*Room\b[\s#: -]*[A-Za-z0-9/\-]+\s*/i, '').trim();
                    primary_name = primary_name.replace(/^[^A-Za-z]+/, '');
                    primary_name = this._strip_leading_section_token(primary_name, text, section);
                    primary_name = this._strip_leading_program_token(primary_name);
                    primary_name = this._cleanup_name_tail(primary_name);
                    primary_name = this._normalize_teacher_title(this._cap_teacher_tokens(primary_name));
                    primary_name = primary_name.replace(/\s+(?:BS|BBA|BSAF|BSCS|BSSE|BSAI|Pharm-?D|DPT|RIT|HND)\b.*$/i, '');
                    primary_name = this._cleanup_name_tail(primary_name);
                    if (/^\s*(Bridging|merge\b|meerge\b)/i.test(primary_name) || primary_name.split(/\s+/).length <= 3) {
                        const mfull = /((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]+[A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*\(\s*(\d{4,6})\s*\)/i.exec(text);
                        if (mfull) {
                            let nm2 = mfull[1];
                            nm2 = this._cleanup_name_tail(nm2);
                            primary_name = this._normalize_teacher_title(this._cap_teacher_tokens(nm2));
                            primary_name = primary_name.replace(/^\s*(?:Bridging|merge\s+with\s+[A-Za-z/&\s]+|meerge\s+with\s+SIS)\s+/i, '');
                        }
                    }
                    if (/\b(reserved|slot|department|used|class)\b/i.test(primary_name)) continue;
                    const after_name = text.substring(match.index + match[0].length);
                    const sap_match = /(\d{4,6})/.exec(after_name);
                    if (sap_match) {
                        return [primary_name.replace(/\s+/g, ' '), sap_match[1]];
                    }
                    return [primary_name.replace(/\s+/g, ' '), ""];
                }
            }
        }

        const mfull = /((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)[\s]+[A-Za-z][A-Za-z\s\.]*[A-Za-z])\s*\(\s*(\d{4,6})\s*\)/i.exec(text);
        if (mfull) {
            const nm = mfull[1];
            const sap = mfull[2];
            const idx = nm.search(/(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?)/);
            let nm2 = nm.substring(idx);
            nm2 = this._cleanup_name_tail(this._normalize_teacher_title(this._cap_teacher_tokens(nm2)));
            nm2 = nm2.replace(/^\s*(?:Bridging|merge\s+with\s+[A-Za-z/&\s]+|meerge\s+with\s+SIS)\s+/i, '');
            return [nm2.replace(/\s+/g, ' '), sap];
        }

        return ["", ""];
    }

    _strip_leading_section_token(name, full_text, section) {
        let name2 = name.replace(/^\(?\s*[IVX]{1,4}\s*-\s*[A-Z]\)?\s+/, '');
        if (name2 !== name) return name2;
        if (section) {
            const secEsc = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (new RegExp(`\\b[IVX]{1,4}\\s*-?\\s*${secEsc}\\b`).test(full_text)) {
                if (new RegExp(`^\\s*${secEsc}\\b\\s*`).test(name)) {
                    return name.replace(new RegExp(`^\\s*${secEsc}\\b\\s*`), '');
                }
            }
            const roman = Object.keys(this.roman_numerals).join('|');
            if (new RegExp(`\\b(${roman})\\s*-?\\s*${secEsc}\\b`).test(full_text)) {
                if (new RegExp(`^\\s*${secEsc}\\b\\s*`).test(name)) {
                    return name.replace(new RegExp(`^\\s*${secEsc}\\b\\s*`), '');
                }
            }
        }
        const roman_letters = [];
        const pattern = /\b([IVX]{1,4})\s*(?:-\s*([A-Z])|\s*([A-Z]))\b/g;
        let m;
        while ((m = pattern.exec(full_text)) !== null) {
            const sec_candidate = m[2] || m[3];
            if (sec_candidate) {
                roman_letters.push(sec_candidate);
            }
        }
        if (roman_letters.length > 0) {
            const first = name.trim().split(/\s+/)[0] || '';
            if (first && first.length === 1 && roman_letters.includes(first)) {
                const firstEsc = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return name.replace(new RegExp(`^\\s*${firstEsc}\\b\\s*`), '');
            }
        }
        return name;
    }

    _strip_leading_program_token(name) {
        let name2 = name.replace(/^\s*(?:[A-Z]{2,}\s*[-/]*\s*[IVX]+(?:\s*\/\s*[A-Z]{2,}\s*[-/]*\s*[IVX]+)*)\s*,?\s*/, '');
        name2 = name2.replace(/^\s*(?:BSCS|BSSE|BSAI|BBA2Y|BBA|BSAF2Y|BSAF|BSDM|BSFT|Pharm-?D|PharmD|BS|DPT|RIT|HND|MLT|SISS|SSISS)\b[\s-]*(?:[IVX]+|\d+)?(?:\s*-\s*[A-Z])?\s*/i, '');
        name2 = name2.replace(/^\s*(?:Math(?:ematics)?|MATH|MATHS)\b[\s-]*(?:[IVX]+|\d+)?\s*/i, '');
        name2 = name2.replace(/^\s*(?:ENG|English|Urdu)\b[\s-]*(?:[IVX]+|\d+)?\s*/i, '');
        name2 = name2.replace(/^\s*(?:Edu|Education|B\.?Ed)\b[\s-]*(?:[IVX]+|\d+)?\s*/i, '');
        name2 = name2.replace(/^\s*(?:IR)\b[\s-]*(?:[IVX]+|\d+)?\s*/i, '');
        name2 = name2.replace(/^\s*(?:B\.?S\.?)\b[\s-]*(?:[IVX]+|\d+)?\s*/i, '');
        name2 = name2.replace(/^\s*(?:[IVX]{1,4})(?:\s*[-/])?\s+(?=(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?|Mufti\.?))/, '');
        return name2;
    }

    _cap_teacher_tokens(name, max_tokens = 4) {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 0) return name.trim();
        const title_tokens = new Set(["Dr.", "Dr", "Prof.", "Prof", "Mr.", "Mr", "Ms.", "Ms", "Miss.", "Miss", "Mufti.", "Mufti"]);
        let kept;
        if (title_tokens.has(parts[0])) {
            const after = parts.slice(1);
            const special = new Set(["e", "bin", "binti", "al", "ul", "ur"]);
            let limit = max_tokens;
            for (let i = 0; i < Math.min(after.length, limit); i++) {
                if (special.has(after[i].toLowerCase()) && i + 1 < after.length) {
                    limit = Math.min(max_tokens + 1, after.length);
                }
            }
            kept = [parts[0], ...after.slice(0, limit)];
        } else {
            kept = parts.slice(0, max_tokens);
        }
        let out = kept.join(' ').replace(/\s+/g, ' ').trim();
        out = out.replace(/[\(\)\[\]\{\},;.:]+$/, '').trim();
        out = out.replace(/\(\d{4,6}\)/, '').trim();
        out = out.replace(/\(\d{4,6}$/, '').trim();
        out = out.replace(/[A-Z]{3,}[\- ]?\d{3,}(?:\|\d+)?\s*/, '').trim();
        const toks = out.split(/\s+/);
        const subject_like_suffixes = ["ship", "ment", "ing", "ion", "ance", "ics", "ology", "ography"];
        const subject_keywords = new Set(["Entrepreneurship", "English", "Finance", "Marketing", "Quantitative", "Environmental", "Business", "Translation", "Understanding", "Industrial", "Operations", "Research", "Functional", "Creativity", "Innovation", "Science", "Law", "Taxation", "Product", "Development", "Sports", "Academic"]);
        let cut_index = null;
        for (let idx = 1; idx < toks.length; idx++) {
            const t = toks[idx];
            if (subject_keywords.has(t)) {
                cut_index = idx;
                break;
            }
            const low = t.toLowerCase();
            if (subject_like_suffixes.some(suf => low.endsWith(suf)) && t.length > 8) {
                cut_index = idx;
                break;
            }
        }
        if (cut_index !== null) {
            out = toks.slice(0, cut_index).join(' ');
        }
        return out;
    }

    _normalize_teacher_title(name) {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 0) return name.trim();
        const female_first_names = new Set(["Alishba", "Aneela", "Saba", "Sana", "Neeli", "Shaista", "Anam", "Aasma", "Kiran", "Maryam", "Muntaha", "Saira", "Bisma", "Ishwa", "Anam", "Aneeba", "Aasma"]);
        if ((parts[0] === "Mr." || parts[0] === "Mr") && parts.length > 1 && female_first_names.has(parts[1])) {
            parts[0] = "Ms.";
        }
        return parts.join(' ');
    }

    _cleanup_name_tail(name) {
        let s = name.trim();
        s = s.replace(/\s*Room\b.*$/i, '').trim();
        s = s.replace(/\s*Lab\b.*$/i, '').trim();
        s = s.replace(/\s*\(SAP[^)]*\)\s*$/i, '').trim();
        s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
        s = s.replace(/[\(\)\[\]\{\},;.:]+$/, '').trim();
        s = s.replace(/\s+\d{1,2}\s*$/, '').trim();
        s = s.replace(/^\s*-?\s*(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\s+(?=[A-Z])/, '');
        s = s.replace(/^\s*(?:IR|R|I)\b\s+(?=[A-Z][a-z])/, '');
        return s.replace(/\s+/g, ' ');
    }

    _extract_global_programs(text) {
        const result = [];
        const seen = new Set();
        for (const pattern of this.program_patterns) {
            const globalPattern = new RegExp(pattern.source, pattern.flags + (pattern.flags.includes('g') ? '' : 'g'));
            let m;
            while ((m = globalPattern.exec(text)) !== null) {
                const program = m[1];
                if (program.toLowerCase() === 'bs' && m.length >= 4 && typeof m[2] === 'string') {
                    const spec = m[2].trim();
                    const sem_raw = m[3];
                    const sec = m[4] || '';
                    const semester = this.convert_roman_to_numeric(sem_raw || '');
                    const spec_norm = (spec === spec.toUpperCase()) ? spec : (spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase());
                    const prog_name = `BS ${spec_norm}`;
                    const key = `${prog_name}|${semester}|${sec}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        result.push([prog_name, semester, sec]);
                    }
                    continue;
                }
                const semester_raw = m[2];
                const section = m.length > 2 ? m[3] : "";
                const semester = this.convert_roman_to_numeric(semester_raw);
                const key = `${program}|${semester}|${section}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push([program, semester, section]);
                }
            }
        }
        const text_norm = text.replace(/\s+/g, ' ');
        const ignore_specs = new Set(["QR", "Quantitative Reasoning", "Exploring Quantitative Skills", "General Mathematics"]);
        const spec_whitelist = new Set(["Biotech", "Biotechnology", "Zoology", "Urdu", "English", "ENG", "Mathematics", "Math", "MATH", "MATHS", "Physics", "Psychology", "Criminology", "Chemistry", "Mathematics For Data Science", "IR", "Nursing", "SISS", "SSISS", "Education", "Edu", "B.Ed", "B.Edu", "PSY", "CRIMINOLOGY", "PHY"]);

        const patterns = [
            /\bBS\s+([IVX]+|\d+)\s+([A-Za-z][A-Za-z&\.\s]+?)(?=,|\/|\)|$)/g,
            /\bBS\s*\(\s*([IVX]+|\d+)\s*\)\s+([A-Za-z][A-Za-z&\.\s]+?)(?=,|\/|\)|$)/g,
            /\bBS\s+([A-Za-z][A-Za-z&\.\s]+?)\s+([IVX]+|\d+)\b/g,
            /\bBS\s+([A-Za-z][A-Za-z&\.\s]+?)\s*\(\s*([IVX]+|\d+)\s*\)\b/g,
            /\bBS\s+([A-Za-z][A-Za-z&\.\s]+?)\s*[-/]\s*([IVX]+|\d+)\b/g
        ];

        const process_bs_match = (sem_raw, spec) => {
            spec = spec.trim();
            const specTitle = spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase();
            if (ignore_specs.has(specTitle)) return;
            if ((spec === spec.toUpperCase() && !spec_whitelist.has(spec)) || (!spec_whitelist.has(specTitle))) return;
            const semester = this.convert_roman_to_numeric(sem_raw);
            const spec_norm = (spec === spec.toUpperCase()) ? spec : specTitle;
            const key = `BS ${spec_norm}|${semester}|`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push([`BS ${spec_norm}`, semester, '']);
            }
        };

        let m;
        while ((m = patterns[0].exec(text_norm)) !== null) process_bs_match(m[1], m[2]);
        while ((m = patterns[1].exec(text_norm)) !== null) process_bs_match(m[1], m[2]);
        while ((m = patterns[2].exec(text_norm)) !== null) process_bs_match(m[2], m[1]);
        while ((m = patterns[3].exec(text_norm)) !== null) process_bs_match(m[2], m[1]);
        while ((m = patterns[4].exec(text_norm)) !== null) process_bs_match(m[2], m[1]);

        const multi_sem_regex = /\bBS\s+([A-Za-z][A-Za-z&\.\s]+?)\s*\(([^\)]*)\)/g;
        while ((m = multi_sem_regex.exec(text_norm)) !== null) {
            const spec = m[1].trim();
            const span = m[2];
            const specTitle = spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase();
            if (ignore_specs.has(specTitle)) continue;
            if ((spec === spec.toUpperCase() && !spec_whitelist.has(spec)) || (!spec_whitelist.has(specTitle))) continue;
            const toks = span.match(/([IVX]+|\d+(?:st|nd|rd|th)?|0)/gi);
            if (toks) {
                for (const tok of toks) {
                    const semester = this.convert_roman_to_numeric(tok);
                    const spec_norm = (spec === spec.toUpperCase()) ? spec : specTitle;
                    const key = `BS ${spec_norm}|${semester}|`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        result.push([`BS ${spec_norm}`, semester, '']);
                    }
                }
            }
        }

        const safe_specs = new Set(["RIT", "HND", "IR", "MLT"]);
        const rit_regex1 = /\b([A-Za-z]{2,}[A-Za-z&\.\s]*)\s+BS\s+([IVX]+|\d{1,2})\b/g;
        while ((m = rit_regex1.exec(text_norm)) !== null) {
            const prog_raw = m[1].trim();
            const prt = prog_raw.toUpperCase().replace('.', '').trim();
            const progTitle = prog_raw.charAt(0).toUpperCase() + prog_raw.slice(1).toLowerCase();
            if (ignore_specs.has(progTitle)) continue;
            if (!safe_specs.has(prt)) continue;
            const semester = this.convert_roman_to_numeric(m[2]);
            const key = `${progTitle}|${semester}|`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push([progTitle, semester, '']);
            }
        }
        const rit_regex2 = /\b([A-Za-z]{2,}[A-Za-z&\.\s]*)\s+BS\s*\(\s*([IVX]+|\d{1,2})\s*\)\b/g;
        while ((m = rit_regex2.exec(text_norm)) !== null) {
            const prog_raw = m[1].trim();
            const prt = prog_raw.toUpperCase().replace('.', '').trim();
            const progTitle = prog_raw.charAt(0).toUpperCase() + prog_raw.slice(1).toLowerCase();
            if (ignore_specs.has(progTitle)) continue;
            if (!safe_specs.has(prt)) continue;
            const semester = this.convert_roman_to_numeric(m[2]);
            const key = `${progTitle}|${semester}|`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push([progTitle, semester, '']);
            }
        }

        const siss_regex = /\bBS\s+([IVX]+|\d{1,2})\s+([A-Za-z]{2,})\b/g;
        while ((m = siss_regex.exec(text_norm)) !== null) {
            const sem_raw = m[1];
            const spec = m[2].trim();
            const spec_norm = (spec === spec.toUpperCase()) ? spec : (spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase());
            if (ignore_specs.has(spec_norm)) continue;
            if (['SISS', 'SSISS'].includes(spec_norm.toUpperCase())) {
                const semester = this.convert_roman_to_numeric(sem_raw);
                const p_name = `BS ${spec_norm.toUpperCase() === 'SSISS' ? 'SISS' : 'SISS'}`;
                const key = `${p_name}|${semester}|`;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push([p_name, semester, '']);
                }
            }
        }

        const bed_regex_g = /\bB\.?Ed(?:\s*[-/]?\s*([IVX]+|\d+))\b/gi;
        let m_bed;
        while ((m_bed = bed_regex_g.exec(text_norm)) !== null) {
            const sem_raw = m_bed[1] || '';
            const semester = (sem_raw && /^[A-Za-z]+$/.test(sem_raw)) ? this.convert_roman_to_numeric(sem_raw) : sem_raw;
            const key = `B.Ed|${semester}|`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(["B.Ed", semester, '']);
            }
        }

        const anchor_prog = /\b(BSCS|BSSE|BSAI|BSMDS|BBA2Y|BBA|BSAF2Y|BSAF|BSDM|BSFT|Pharm-?D|PharmD|BS|DPT|RIT|HND|MLT)\b/gi;
        let am;
        while ((am = anchor_prog.exec(text)) !== null) {
            const prog = am[1].toUpperCase();
            const tail = text.substring(am.index + am[0].length);
            const mlocal = /^\s*(?:[-/]\s*)?([IVX]+|\d{1,2}(?:ST|ND|RD|TH)?)(?:\s*-\s*([A-Z]))?/.exec(tail);
            if (mlocal) {
                const sem_raw = mlocal[1];
                const sec = mlocal[2] || '';
                const semester = this.convert_roman_to_numeric(sem_raw);
                const key = `${prog}|${semester}|${sec}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push([prog, semester, sec]);
                }
            } else {
                if (["BSCS", "BSSE", "BSAI", "BSMDS", "BBA2Y", "BBA", "BSAF2Y", "BSAF", "BSDM", "BSFT", "RIT", "HND", "MLT"].includes(prog)) {
                    const key = `${prog}||`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        result.push([prog, '', '']);
                    }
                }
            }
        }

        const list_regex = /\b((?:RIT|HND|MLT)(?:\s*(?:[,/&]|\band\b)\s*(?:RIT|HND|MLT))+)[\s,&/\-]*([IVX]+|\d{1,2}(?:ST|ND|RD|TH)?)/g;
        while ((m = list_regex.exec(text_norm)) !== null) {
            const list_chunk = m[1];
            const sem_raw = m[2];
            const semester = this.convert_roman_to_numeric(sem_raw);
            const prgs = list_chunk.match(/\b(RIT|HND|MLT)\b/g);
            if (prgs) {
                for (const prg of prgs) {
                    const key = `${prg.toUpperCase()}|${semester}|`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        result.push([prg.toUpperCase(), semester, '']);
                    }
                }
            }
        }

        const single_regex = /\b(RIT|HND|MLT)\b\s*[-/&,]*\s*([IVX]+|\d{1,2}(?:ST|ND|RD|TH)?)/g;
        while ((m = single_regex.exec(text_norm)) !== null) {
            const prog = m[1].toUpperCase();
            const sem_raw = m[2];
            const semester = this.convert_roman_to_numeric(sem_raw);
            const key = `${prog}|${semester}|`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push([prog, semester, '']);
            }
        }

        const variants_regex = /\b(BSAF|BBA|BSDM|BSFT)\b\s*2Y\s*\(\s*([IVX]+|\d{1,2})\s*\)/g;
        while ((m = variants_regex.exec(text_norm)) !== null) {
            const prog = m[1].toUpperCase() + '2Y';
            const semester = this.convert_roman_to_numeric(m[2]);
            const key = `${prog}|${semester}|`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push([prog, semester, '']);
            }
        }
        const variants_regex2 = /\b(BSAF|BBA|BSDM|BSFT)\b\s*2Y\s*[-/]\s*([IVX]+|\d{1,2})\b/g;
        while ((m = variants_regex2.exec(text_norm)) !== null) {
            const prog = m[1].toUpperCase() + '2Y';
            const semester = this.convert_roman_to_numeric(m[2]);
            const key = `${prog}|${semester}|`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push([prog, semester, '']);
            }
        }
        const variants_regex3 = /\b(BSAF|BBA|BSDM|BSFT)\b\s*2Y\b/g;
        while ((m = variants_regex3.exec(text_norm)) !== null) {
            const prog = m[1].toUpperCase() + '2Y';
            const key = `${prog}||`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push([prog, '', '']);
            }
        }

        const bs_vii_regex = /\bBS\s*[-]?\s*([IVX]+|\d{1,2})\s*[-]\s*([A-Z]{2,})\b/g;
        while ((m = bs_vii_regex.exec(text_norm)) !== null) {
            const sem_raw = m[1];
            const spec = m[2];
            const semester = this.convert_roman_to_numeric(sem_raw);
            const spec_norm = (spec === spec.toUpperCase()) ? spec : (spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase());
            const key = `BS ${spec_norm}|${semester}|`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push([`BS ${spec_norm}`, semester, '']);
            }
        }

        const bs_comma_regex = /\bBS\s+((?:[IVX]+|\d{1,2})(?:\s*,\s*(?:[IVX]+|\d{1,2}))+)(?=\b|\s)/g;
        while ((m = bs_comma_regex.exec(text_norm)) !== null) {
            const list_chunk = m[1];
            const toks = list_chunk.match(/[IVX]+|\d{1,2}/g);
            if (toks) {
                for (const tok of toks) {
                    const semester = this.convert_roman_to_numeric(tok);
                    const key = `BS|${semester}|`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        result.push(["BS", semester, '']);
                    }
                }
            }
        }

        const spec_sem_regex = /\b(Biotech|Biotechnology|Chemistry|Zoology|English|ENG|Mathematics|Math|MATH|MATHS|Physics|Psychology|IR)\b\s*-?\s*([IVX]+|\d{1,2})\b/g;
        while ((m = spec_sem_regex.exec(text_norm)) !== null) {
            const spec = m[1];
            const sem_raw = m[2];
            if (["RIT", "HND", "DPT"].includes(spec.toUpperCase())) continue;
            const semester = this.convert_roman_to_numeric(sem_raw);
            const spec_norm = (spec === spec.toUpperCase()) ? spec : (spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase());
            const key = `BS ${spec_norm}|${semester}|`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push([`BS ${spec_norm}`, semester, '']);
            }
        }

        if (result.length > 0) {
            const best = {};
            for (const [p, s, sec] of result) {
                const k = `${p}|${s}`;
                if (!best[k] || (best[k] === '' && sec)) {
                    best[k] = sec;
                }
            }
            const uniq = [];
            const seen2 = new Set();
            for (const k in best) {
                const [p, s] = k.split('|');
                const sec = best[k];
                const key = `${p}|${s}|${sec}`;
                if (!seen2.has(key)) {
                    seen2.add(key);
                    uniq.push([p, s, sec]);
                }
            }
            const norm = [];
            for (let [p, s, sec] of uniq) {
                if (p.startsWith('BS ')) {
                    const spec = p.substring(3).trim();
                    let spec2 = (spec === spec.toUpperCase()) ? spec : (spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase());
                    const syn = {
                        'Maths': 'Mathematics',
                        'MATHS': 'Mathematics',
                        'Math': 'Mathematics',
                        'MATH': 'Mathematics',
                        'ENG': 'English',
                        'Edu': 'Education',
                        'SSISS': 'SISS',
                        'URDU': 'Urdu'
                    };
                    spec2 = syn[spec2] || spec2;
                    p = 'BS ' + spec2;
                } else if (/^[A-Za-z]+$/.test(p)) {
                    if (p.toUpperCase().startsWith('BS')) {
                        p = p.toUpperCase();
                    } else if (p.length <= 4) {
                        p = p.toUpperCase();
                    } else {
                        p = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
                    }
                }
                norm.push([p, s, sec]);
            }

            let uniq2 = [];
            const seen_ci = new Set();
            for (const [p, s, sec] of norm) {
                const kci = `${p.toLowerCase()}|${s}|${sec}`;
                if (!seen_ci.has(kci)) {
                    seen_ci.add(kci);
                    uniq2.push([p, s, sec]);
                }
            }
            const drop_titles = new Set(["Dr", "Dr.", "Mr", "Mr.", "Ms", "Ms.", "Miss", "Miss.", "Mufti", "Mufti."]);
            uniq2 = uniq2.filter(t => !(t[0].startsWith('BS ') && drop_titles.has(t[0].split(' ')[1])));

            const spec_sems = new Set(uniq2.filter(t => t[0].startsWith('BS ') && t[0] !== 'BS').map(t => t[1]));
            if (spec_sems.size > 0) {
                uniq2 = uniq2.filter(t => !(t[0] === 'BS' && spec_sems.has(t[1])));
            }
            const non_bs_sems = new Set(uniq2.filter(t => !t[0].startsWith('BS')).map(t => t[1]));
            uniq2 = uniq2.filter(t => !(t[0] === 'BS' && non_bs_sems.has(t[1])));

            const nums = uniq2.map(t => parseInt(t[1])).filter(n => !isNaN(n) && n > 0);
            let fill = '';
            if (uniq2.some(t => t[1] === '1')) {
                fill = '1';
            } else if (nums.length > 0) {
                fill = String(Math.min(...nums));
            }
            if (fill) {
                const anchor_fill = new Set(["BSCS", "BSSE", "BSAI", "BSMDS", "BBA2Y", "BBA", "BSAF2Y", "BSAF", "BSDM", "BSFT", "RIT", "HND", "MLT"]);
                uniq2 = uniq2.map(([p, s, sec]) => {
                    if ((p.startsWith('BS ') || anchor_fill.has(p)) && s === '') {
                        return [p, fill, sec];
                    }
                    return [p, s, sec];
                });
            }

            const norm2 = [];
            for (let [p, s, sec] of uniq2) {
                if (!p.startsWith('BS ')) {
                    if (/^B\.?Edu$/i.test(p)) {
                        p = 'B.Ed';
                    }
                }
                norm2.push([p, s, sec]);
            }

            const seen_final = new Set();
            const out_final = [];
            for (const [p, s, sec] of norm2) {
                const k = `${p.toLowerCase()}|${s}|${sec}`;
                if (!seen_final.has(k)) {
                    seen_final.add(k);
                    out_final.push([p, s, sec]);
                }
            }
            return out_final;
        }
        return result;
    }

    _is_program_metadata_segment(segment, subject) {
        const s = (subject || '').trim();
        const seg = (segment || '').trim();
        if (!s) return true;
        if (/^[\s,\-/()]+$/.test(s)) return true;
        if (/^\s*[\(,]*\s*(?:BSCS|BSSE|BSAI|BBA2Y|BBA|BSAF2Y|BSAF|BSDM|BSFT|Pharm-?D|PharmD|BS|DPT|RIT|HND|MLT)\b/i.test(s)) return true;
        if (/^\s*[\(,]*\s*(?:BSCS|BSSE|BSAI|BBA2Y|BBA|BSAF2Y|BSAF|BSDM|BSFT|Pharm-?D|PharmD|BS|DPT|RIT|HND|MLT)\b/i.test(seg)) return true;
        if (/^\s*,\s*$/.test(seg)) return true;
        return false;
    }

    convert_roman_to_numeric(roman) {
        if (roman === null || roman === undefined) return "";
        const ru = String(roman).toUpperCase().trim();
        const m = /^(\d+)(?:ST|ND|RD|TH)?$/.exec(ru);
        if (m) return m[1];
        if (/^\d+$/.test(ru)) return ru;
        return this.roman_numerals[ru] || String(roman);
    }

    is_reserved_cell(content) {
        if (!content || !content.trim()) return true;
        const text = content.trim();
        const has_program = this.program_patterns.some(p => new RegExp(p.source, p.flags + (p.flags.includes('g') ? '' : 'g')).test(text));
        const has_course = this.course_code_patterns.some(c => new RegExp(c.source, c.flags + (c.flags.includes('g') ? '' : 'g')).test(text));
        if (has_program || has_course) return false;
        return this.reserved_regex.test(text);
    }

    infer_program_from_context(department, text) {
        if (/\bPharm-?D\b|\bPharmD\b/i.test(text)) return "PharmD";
        if (department.toUpperCase() === "PHARM-D") return "PharmD";
        if (/\bDPT\b/.test(text) || department.toUpperCase() === "DPT") return "DPT";
        if (/HND/i.test(department) || department.trim().toLowerCase() === 'human nutrition and dietetics') return "HND";
        return "";
    }

    extract_semester_section_from_any(text) {
        const anchored = /\b(?:BSCS|BSSE|BSAI|BBA2Y|BBA|BSAF2Y|BSAF|BSDM|BSFT|Pharm-?D|PharmD|BS|DPT|RIT|HND|MLT)\b[\s-]*([IVX]+|\d+(?:ST|ND|RD|TH)?)\s*(?:-\s*([A-Z])(?![A-Za-z]))?/i.exec(text);
        if (anchored) {
            const sem = this.convert_roman_to_numeric(anchored[1]);
            const sec = anchored[2] || "";
            return [sem, sec];
        }
        const m = /\b([IVX]{1,4})\s*-\s*([A-Z])(?![A-Za-z])\b/.exec(text);
        if (m) {
            const sem = this.convert_roman_to_numeric(m[1]);
            const sec = m[2];
            if (/\bRoom\b/i.test(text.substring(m.index + m[0].length))) {
                return [sem, ""];
            }
            return [sem, sec];
        }
        const sm = /\bSemester\s*#?\s*([IVX]+|\d+(?:ST|ND|RD|TH)?)\b/i.exec(text);
        if (sm) {
            return [this.convert_roman_to_numeric(sm[1]), ""];
        }
        const sm2 = /\b(\d{1,2})(?:ST|ND|RD|TH)\s*sem(?:ester|ster)\b/i.exec(text);
        if (sm2) {
            return [sm2[1], ""];
        }
        return ["", ""];
    }

    post_process_entries(entries) {
        if (!entries || entries.length === 0) return [];
        const unique_entries = [];
        const seen = new Set();
        for (const entry of entries) {
            const key = `${entry.day}|${entry.department}|${entry.sub_department}|${entry.time_slot}|${entry.room_name}|${entry.subject}|${entry.program}|${entry.semester}|${entry.section}|${entry.teacher_name}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique_entries.push(entry);
            }
        }
        let processed = this._annotate_csit_lab_sections(unique_entries);
        processed.sort((a, b) => {
            if (a.day !== b.day) return a.day.localeCompare(b.day);
            if (a.time_slot !== b.time_slot) return a.time_slot.localeCompare(b.time_slot);
            if (a.department !== b.department) return a.department.localeCompare(b.department);
            return 0;
        });
        return processed;
    }

    _annotate_csit_lab_sections(entries) {
        const csit_labs = entries.filter(e => e.department === 'CS & IT' && /\bLab\b/i.test(e.room_name));
        const others = entries.filter(e => !(e.department === 'CS & IT' && /\bLab\b/i.test(e.room_name)));

        // Group by (day, room, subject, program, semester, section, teacher)
        const groups = {};
        for (const entry of csit_labs) {
            const key = `${entry.day}|${entry.room_name}|${entry.subject}|${entry.program}|${entry.semester}|${entry.section}|${entry.teacher_name}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(entry);
        }

        const processed_labs = [];
        for (const key in groups) {
            const group = groups[key];
            group.sort((a, b) => a.time_slot.localeCompare(b.time_slot));

            const chunks = [];
            if (group.length > 0) {
                let current_chunk = [group[0]];
                for (let i = 1; i < group.length; i++) {
                    const prev = group[i - 1];
                    const curr = group[i];
                    if (this.are_consecutive_slots(prev.time_slot, curr.time_slot)) {
                        current_chunk.push(curr);
                    } else {
                        chunks.push(current_chunk);
                        current_chunk = [curr];
                    }
                }
                chunks.push(current_chunk);
            }

            for (const chunk of chunks) {
                if (chunk.length >= 2) {
                    for (let i = 0; i < chunk.length; i++) {
                        const entry = chunk[i];
                        if (i === 0) entry.lab_annotation = "(Lab start)";
                        else if (i === chunk.length - 1) entry.lab_annotation = "(Lab end)";
                        else entry.lab_annotation = "(Lab cont)";
                        processed_labs.push(entry);
                    }
                } else {
                    processed_labs.push(...chunk);
                }
            }
        }
        return [...others, ...processed_labs];
    }

    are_consecutive_slots(slot1, slot2) {
        const parse_time = (t) => {
            const [start, end] = t.split('-').map(s => s.trim());
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            return [sh * 60 + sm, eh * 60 + em];
        };
        try {
            const [s1_start, s1_end] = parse_time(slot1);
            const [s2_start, s2_end] = parse_time(slot2);
            return Math.abs(s2_start - s1_end) <= 10; // 10 minutes tolerance
        } catch (e) {
            return false;
        }
    }

    _assign_programs_to_entries(entries, content) {
        const globals_list = this._extract_global_programs(content);
        if (globals_list && globals_list.length > 0) {
            const out = [];
            for (const entry of entries) {
                if (!entry.program) {
                    if (globals_list.length > 1) {
                        const merged_info = globals_list.map(([p, s, sec]) => ({
                            'program': p,
                            'semester': s,
                            'section': sec
                        }));
                        for (const [p, s, sec] of globals_list) {
                            const new_ent = { ...entry };
                            new_ent.program = p;
                            new_ent.semester = s;
                            new_ent.section = sec;
                            new_ent.is_merged_class = 'true';
                            new_ent.merged_programs = merged_info;
                            out.push(new_ent);
                        }
                    } else {
                        const [p, s, sec] = globals_list[0];
                        entry.program = p;
                        entry.semester = s;
                        entry.section = sec;
                        out.push(entry);
                    }
                } else {
                    out.push(entry);
                }
            }
            return out;
        }
        return entries;
    }

    extract_department_info(text) {
        const m = this.department_pattern.exec(text);
        if (m) {
            return [this._normalize_department_name(m[1]), m[2]];
        }
        return [null, null];
    }

    extract_time_slots(row) {
        const slots = [];
        for (const cell of row) {
            const m = this.time_slot_pattern.exec(cell);
            if (m) {
                slots.push(m[0]);
            }
        }
        return slots;
    }

    extract_capacity(text) {
        const m = this.capacity_pattern.exec(text);
        return m ? m[1] : "";
    }

    extract_sap_room_id(text) {
        const m = this.sap_room_pattern.exec(text);
        return m ? m[1] : "";
    }
}

function parse_csv_content(file_content) {
    const parser = new AdvancedTimetableParser();
    return parser.parse_csv_file(file_content);
}

function build_allowed_index(file_content) {
    const parser = new AdvancedTimetableParser();
    const rows = parser.parseCSVString(file_content);
    parser._build_allowed_index(rows);
    const out = {};
    for (const dept in parser.allowed_subdepts_by_dept) {
        out[dept] = Array.from(parser.allowed_subdepts_by_dept[dept]).sort();
    }
    return {
        'departments': Array.from(parser.allowed_departments).sort(),
        'subdepartments': out
    };
}

module.exports = { parse_csv_content, build_allowed_index, AdvancedTimetableParser };
