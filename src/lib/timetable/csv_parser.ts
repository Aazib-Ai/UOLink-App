export type TimetableEntry = {
  day: string
  department: string
  sub_department: string
  time_slot: string
  room_name: string
  subject: string
  course_code: string
  program: string
  semester: string
  section: string
  teacher_name: string
  teacher_sap_id: string
  raw_text: string
  is_lab_session?: string
  lab_duration?: string
}

class AdvancedTimetableParser {
  private departmentPattern = new RegExp(
    String.raw`^([A-Z][A-Za-z\s&/()\-']{2,60})\s*-\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)`,
    'i'
  )
  private timeSlotPattern = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/
  private capacityPattern = /S\.?C\.?\s*:\s*(\d+)/i
  private sapRoomPattern = /([A-Z]-[A-Z0-9\-]+)/

  private courseCodePatterns: RegExp[] = [
    /\b([A-Z]+)\s*-?\s*(\d{3,5})(?:\/\d{1,2})?\b/,
    /\(([A-Z]+)\s*(\d{3,5})(?:\/\d{1,2})?\)/,
    /\(([A-Z]+)(\d{3,5})(?:\/\d{1,2})?\)/,
    /\b([A-Z]+)\s*-\s*(\d{3,5})\b/,
  ]

  private programPatterns: RegExp[] = [
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
    /(BSAF)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
    /(BSAF2Y)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
    /(BSDM)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
    /(BSFT)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
    /(BS)\s+(\d+)([A-Z]?)(?![a-z])/,
    /(BS)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
    /(DPT)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
    /(RIT)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
    /(HND)[-]?([IVX]+)([A-Z]?)(?![a-z])/,
  ]

  private teacherPatterns: RegExp[] = [
    /\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?)\s+[A-Za-z\s\.]+[A-Za-z])\s*(\d{4,6})\s*$/,
    /\b([A-Za-z][A-Za-z\s\.]+[A-Za-z])\s*\((\d{4,6})\)\s*$/,
    /\b([A-Za-z][A-Za-z\s\.]+[A-Za-z])\s*(\d{4,6})\s*$/,
    /\b((?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Miss\.?)\s+[A-Za-z\s\.]+[A-Za-z])\s*$/,
    /\b([A-Za-z][A-Za-z\s\.]{2,}[A-Za-z])\s*$/,
  ]

  private romanNumerals: Record<string, string> = {
    I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8', IX: '9', X: '10'
  }

  private reservedRegex = new RegExp(
    [
      String.raw`^\s*reserved\s*$`,
      String.raw`^\s*cs\s*reserved\s*$`,
      String.raw`^\s*math\s*reserved\s*$`,
      String.raw`^\s*dms\s*reserved\s*$`,
      String.raw`^\s*slot\s*used\s*$`,
      String.raw`^\s*new\s*hiring\s*$`,
      String.raw`^\s*new\s*appointment\s*$`,
    ].join('|'),
    'i'
  )

  private rawGrid: string[][] = []

  parse(csv: string): TimetableEntry[] {
    this.rawGrid = this.parseCsvGrid(csv)
    const rows = this.rawGrid
    const parsedEntries: TimetableEntry[] = []
    let currentDepartment: string | null = null
    let currentDay: string | null = null
    let currentTimeSlots: string[] = []

    let i = 0
    while (i < rows.length) {
      const row = rows[i]
      if (!row || row.every((c) => c.trim() === '')) {
        i++
        continue
      }

      const deptInfo = this.extractDepartmentInfo(row)
      if (deptInfo) {
        currentDepartment = deptInfo.department
        currentDay = deptInfo.day
        currentTimeSlots = []
        i++
        continue
      }

      if (currentDepartment && currentTimeSlots.length === 0) {
        const slots = this.extractTimeSlots(row)
        if (slots.length) {
          currentTimeSlots = slots
          i++
          continue
        }
      }

      if (currentDepartment && currentDay && currentTimeSlots.length > 0) {
        const roomName = (row[0] || '').trim()
        if (/Room\s*\/\s*Labs/i.test(roomName)) {
          i++
          continue
        }

        const roomCapacity = this.extractCapacity(roomName)
        const sapRoomId = this.extractSapRoomId(roomName)

        const entries = this.processRoomRowAdvanced(
          row,
          i,
          currentDepartment,
          currentDay,
          currentTimeSlots,
          roomName,
          roomCapacity,
          sapRoomId
        )
        parsedEntries.push(...entries)
      }

      i++
    }

    return this.postProcessEntries(parsedEntries)
  }

  private parseCsvGrid(csv: string): string[][] {
    // RFC4180-style parsing with multi-line quoted fields and skipinitialspace
    const rows: string[][] = []
    let row: string[] = []
    let field = ''
    let inQuotes = false
    let i = 0
    const n = csv.length

    const pushField = () => {
      row.push(field.trim())
      field = ''
    }
    const pushRow = () => {
      // allow empty trailing field
      pushField()
      rows.push(row)
      row = []
    }

    while (i < n) {
      const ch = csv[i]
      if (ch === '"') {
        if (inQuotes && csv[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        } else {
          inQuotes = !inQuotes
          i++
          continue
        }
      }
      if (!inQuotes && ch === ',') {
        // skipinitialspace behavior: consume spaces immediately after comma
        pushField()
        i++
        while (i < n && csv[i] === ' ') i++
        continue
      }
      if (!inQuotes && (ch === '\n' || ch === '\r')) {
        // handle CRLF or LF as row terminator when not in quotes
        // if CRLF, skip the LF
        pushRow()
        if (ch === '\r' && csv[i + 1] === '\n') i += 2
        else i++
        // skip initial spaces of the next row's first field
        while (i < n && csv[i] === ' ') i++
        continue
      }
      field += ch
      i++
    }
    // finalize last row if any content
    if (field.length > 0 || row.length > 0) {
      pushRow()
    }
    return rows
  }

  private extractDepartmentInfo(row: string[]): { department: string; day: string } | null {
    const first = (row[0] || '').trim()
    const m = first.match(this.departmentPattern)
    if (m) {
      let department = m[1].trim().replace(/\s+/g, ' ').replace(/^["']|["']$/g, '')
      const day = m[2].trim()
      return { department, day }
    }
    return null
  }

  private extractTimeSlots(row: string[]): string[] {
    const slots: string[] = []
    for (const cell of row.slice(1)) {
      const c = (cell || '').trim()
      if (this.timeSlotPattern.test(c)) {
        slots.push(c)
      }
    }
    return slots
  }

  private extractCapacity(roomText: string): string {
    const m = roomText.match(this.capacityPattern)
    return m ? m[1] : ''
  }

  private extractSapRoomId(roomText: string): string {
    const m = roomText.match(this.sapRoomPattern)
    return m ? m[1] : ''
  }

  private isReservedCell(content: string): boolean {
    const text = (content || '').trim()
    if (!text) return true
    const hasProgram = this.containsProgram(text)
    const hasCourse = this.courseCodePatterns.some((c) => c.test(text))
    if (hasProgram || hasCourse) return false
    return this.reservedRegex.test(text)
  }

  private processRoomRowAdvanced(
    row: string[],
    rowIndex: number,
    department: string,
    day: string,
    timeSlots: string[],
    roomName: string,
    roomCapacity: string,
    sapRoomId: string
  ): TimetableEntry[] {
    const entries: TimetableEntry[] = []
    for (let colIdx = 1; colIdx < Math.min(row.length, timeSlots.length + 1); colIdx++) {
      const cellContent = (row[colIdx] || '').trim()
      if (!cellContent || this.isReservedCell(cellContent)) continue
      const extended = this.getExtendedCellContent(rowIndex, colIdx, cellContent)
      const classEntries = this.parseClassEntryComprehensive(
        extended,
        department,
        day,
        timeSlots[colIdx - 1],
        roomName,
        roomCapacity,
        sapRoomId
      )
      const labEntries = this.detectLabSessions(
        extended,
        department,
        day,
        timeSlots,
        colIdx - 1,
        roomName,
        roomCapacity,
        sapRoomId
      )
      entries.push(...classEntries)
      entries.push(...labEntries)
    }
    return entries
  }

  private getExtendedCellContent(rowIndex: number, colIndex: number, base: string): string {
    let extended = base
    const currentRow = this.rawGrid[rowIndex] || []
    for (let nextCol = colIndex + 1; nextCol < Math.min(colIndex + 3, currentRow.length); nextCol++) {
      const nextCell = (currentRow[nextCol] || '').trim()
      if (nextCell && !this.isReservedCell(nextCell)) {
        if (!this.containsProgram(nextCell)) {
          extended += ' ' + nextCell
        }
      }
    }
    const nextRow = this.rawGrid[rowIndex + 1]
    if (nextRow && colIndex < nextRow.length) {
      const downCell = (nextRow[colIndex] || '').trim()
      if (downCell && !this.isReservedCell(downCell)) {
        if ((downCell[0] && downCell[0] === downCell[0].toLowerCase()) || !this.containsProgram(downCell)) {
          extended += ' ' + downCell
        }
      }
    }
    return extended
  }

  private containsProgram(text: string): boolean {
    return this.programPatterns.some((p) => p.test(text))
  }

  private detectLabSessions(
    content: string,
    department: string,
    day: string,
    timeSlots: string[],
    startSlotIndex: number,
    roomName: string,
    roomCapacity: string,
    sapRoomId: string
  ): TimetableEntry[] {
    const labEntries: TimetableEntry[] = []
    const [subjectText, courseCodeText] = this.extractSubjectAndCourseCode(content)
    let isLab = false
    if (/\bLAB\b|\bLab\b|\bLaboratory\b|\bPractical\b/i.test(content)) isLab = true
    if (/\b[A-Z]+[- ]?\d{3,4}L\b/.test(content)) isLab = true
    if (/\bLAB\b|\bLab\b/i.test(subjectText)) isLab = true

    if (isLab) {
      const programs = this.extractPrograms(content)
      if (programs.length) {
        const span = Math.min(3, Math.max(0, timeSlots.length - startSlotIndex))
        for (let offset = 0; offset < span; offset++) {
          const idx = startSlotIndex + offset
          if (idx >= timeSlots.length) break
          for (const [program, semester, section] of programs) {
            const entry = this.createClassEntry(
              content,
              department,
              day,
              timeSlots[idx],
              roomName,
              roomCapacity,
              sapRoomId,
              program,
              semester,
              section
            )
            entry.is_lab_session = 'true'
            entry.lab_duration = '3_hours'
            labEntries.push(entry)
          }
        }
      }
    }
    return labEntries
  }

  private extractPrograms(content: string): Array<[string, string, string]> {
    const matches: Array<[string, string, string]> = []
    for (const p of this.programPatterns) {
      const found = content.match(new RegExp(p.source, 'g'))
      if (!found) continue
      for (const seg of found) {
        const m = seg.match(p)
        if (!m) continue
        const program = m[1]
        const semRaw = m[2]
        const section = (m[3] ?? '').trim()
        const semester = /^[IVX]+$/.test(semRaw)
          ? this.convertRomanToNumeric(semRaw)
          : semRaw
        matches.push([program, semester, section])
      }
    }
    // dedupe
    const seen = new Set<string>()
    const unique: Array<[string, string, string]> = []
    for (const t of matches) {
      const key = t.join('|')
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(t)
      }
    }
    return unique
  }

  private normalizeCourseCode(prefix: string, digits: string): string {
    // Normalize to "PREFIX DIGITS" and strip any slash suffixes later
    return `${prefix.trim()} ${digits.trim()}`.replace(/\s+/g, ' ').trim()
  }

  private extractSubjectAndCourseCode(content: string): [string, string] {
    const cleaned = content.replace(/\s+/g, ' ').trim()
    for (const p of this.courseCodePatterns) {
      const exec = p.exec(cleaned)
      if (exec) {
        let code = this.normalizeCourseCode(exec[1], exec[2])
        code = code.replace(/\s*\/\d{1,2}\s*$/g, '')
        // Subject is everything before the course code match
        const startIdx = exec.index ?? cleaned.indexOf(exec[0])
        let subject = cleaned.slice(0, startIdx).trim()
        subject = subject.replace(/\bRoom\b.*$/i, '')
        subject = subject.replace(/\bLab\b.*$/i, '')
        subject = subject.replace(/[\/]{2,}/g, '/')
        subject = subject.replace(/\s+/g, ' ').trim()
        return [subject, code]
      }
    }
    // Fallback: attempt subject before first program
    for (const p of this.programPatterns) {
      const exec = p.exec(cleaned)
      if (exec) {
        const startIdx = exec.index ?? cleaned.indexOf(exec[0])
        let subject = cleaned.slice(0, startIdx).trim()
        subject = subject.replace(/\bRoom\b.*$/i, '')
        subject = subject.replace(/\bLab\b.*$/i, '')
        subject = subject.replace(/[\/]{2,}/g, '/')
        subject = subject.replace(/\s+/g, ' ').trim()
        return [subject, '']
      }
    }
    // Otherwise keep first 4 words or whole
    const words = cleaned.split(/\s+/)
    const subject = (words.length > 4 ? words.slice(0, 4).join(' ') : cleaned).trim()
    return [subject, '']
  }

  private extractTeacherInfo(text: string): [string, string] {
    // Try each pattern; prefer matches with SAP ID
    let candidateName = ''
    let candidateSap = ''
    for (const p of this.teacherPatterns) {
      const m = text.match(p)
      if (m) {
        const nameRaw = (m[1] || '').trim()
        const name = nameRaw.split(/\s*[,&\/]\s*/)[0]
        const cleanName = name
          .replace(/\s*Room\b.*$/i, '')
          .replace(/^[^A-Za-z]+/, '')
          .replace(/\s+/g, ' ')
          .trim()
        const sap = (m[2] || '').trim()
        if (sap) return [cleanName, sap]
        if (!candidateName) candidateName = cleanName
      }
    }
    if (candidateName) return [candidateName, '']

    // Fallback: after last program match
    const programMatches: Array<{ start: number; end: number }> = []
    for (const p of this.programPatterns) {
      const g = new RegExp(p.source, 'g')
      let mm: RegExpExecArray | null
      while ((mm = g.exec(text)) !== null) {
        programMatches.push({ start: mm.index, end: mm.index + mm[0].length })
      }
    }
    if (programMatches.length) {
      const last = programMatches.reduce((a, b) => (a.end > b.end ? a : b))
      const after = text.slice(last.end).trim()
      if (after) {
        const sapMatch = after.match(/(\d{4,6})\s*$/)
        if (sapMatch) {
          const sap = sapMatch[1]
          const namePart = after.slice(0, sapMatch.index!).trim()
          const primary = namePart.split(/\s*[,&\/]\s*/)[0]
          const clean = primary
            .replace(/\s*Room\b.*$/i, '')
            .replace(/^[^A-Za-z]+/, '')
            .replace(/\s+/g, ' ')
            .trim()
          return [clean, sap]
        } else {
          const clean = after
            .replace(/\s*Room\b.*$/i, '')
            .replace(/^[^A-Za-z]+/, '')
            .replace(/\s+/g, ' ')
            .trim()
          if (clean && clean.length > 2) {
            const primary = clean.split(/\s*[,&\/]\s*/)[0]
            return [primary, '']
          }
        }
      }
    }
    return ['', '']
  }

  private getSubDepartment(department: string, program: string): string {
    switch (department) {
      case 'CS & IT':
        if (program === 'BSCS') return 'Computer Science'
        if (program === 'BSSE') return 'Software Engineering'
        if (program === 'BSAI') return 'Artificial Intelligence'
        return 'CS & IT General'
      case 'LAHORE BUSINESS SCHOOL':
        if (program === 'BBA' || program === 'BBA2Y') return 'Business Administration'
        if (program === 'BSAF' || program === 'BSAF2Y') return 'Accounting & Finance'
        if (program === 'BSDM') return 'Digital Marketing'
        if (program === 'BSFT') return 'Financial Technology'
        return 'Business General'
      case 'ENGLISH':
        return program === 'BS' ? 'English Literature' : 'English General'
      case 'ZOOLOGY':
        return program === 'BS' ? 'Zoology' : 'Zoology General'
      case 'CHEMISTRY':
        return program === 'BS' ? 'Chemistry' : 'Chemistry General'
      case 'MATHEMATICS':
        return program === 'BS' ? 'Mathematics' : 'Mathematics General'
      case 'PHYSICS':
        return program === 'BS' ? 'Physics' : 'Physics General'
      case 'PSYCHOLOGY':
        return program === 'BS' ? 'Psychology' : 'Psychology General'
      case 'BIO TECHNOLOGY':
        return program === 'BS' ? 'Biotechnology' : 'Biotechnology General'
      case 'DPT':
        return 'Doctor of Physical Therapy'
      case 'Radiology and Imaging Technology/Medical Lab Technology':
        if (program === 'RIT') return 'Radiology & Imaging Technology'
        if (program === 'HND') return 'Medical Lab Technology'
        return 'Medical Technology General'
      case 'School of Nursing':
        return 'Nursing'
      case 'PHARM-D':
        return 'Pharmacy'
      case 'EDUCATION':
        return 'Education'
      case 'SSISS':
        return 'Social Sciences'
      case 'URDU':
        return 'Urdu Literature'
      case 'ISLAMIC STUDY':
        return 'Islamic Studies'
      default:
        return department
    }
  }

  private createClassEntry(
    content: string,
    department: string,
    day: string,
    timeSlot: string,
    roomName: string,
    roomCapacity: string,
    sapRoomId: string,
    program: string,
    semester: string,
    section: string
  ): TimetableEntry {
    const [subject, courseCode] = this.extractSubjectAndCourseCode(content)
    let teacherName = ''
    let teacherSapId = ''
    const [name, sap] = this.extractTeacherInfo(content)
    teacherName = name
    teacherSapId = sap

    if (!roomName) {
      const inlineRoom = this.extractInlineRoom(content)
      if (inlineRoom) roomName = inlineRoom
    }

    const subDept = this.getSubDepartment(department, program)

    return {
      day,
      department,
      sub_department: subDept,
      time_slot: timeSlot,
      room_name: roomName,
      subject,
      course_code: courseCode,
      program,
      semester,
      section,
      teacher_name: teacherName,
      teacher_sap_id: teacherSapId,
      raw_text: content,
    }
  }

  private extractInlineRoom(text: string): string {
    // Room#703, Room #703, Room # 605
    let m = text.match(/Room\s*#\s*(\d+)/i)
    if (m) return `Room#${m[1]}`
    // Fallback: Room token followed by identifier token
    const m2 = text.match(/\bRoom\s*[#:]*\s*([A-Z0-9\-/]+)/i)
    if (m2) return `Room ${m2[1]}`
    return ''
  }

  private parseClassEntryComprehensive(
    cellContent: string,
    department: string,
    day: string,
    timeSlot: string,
    roomName: string,
    roomCapacity: string,
    sapRoomId: string
  ): TimetableEntry[] {
    const content = cellContent
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(' ')
    if (!content || this.isReservedCell(content)) return []

    const programs = this.extractPrograms(content)
    if (programs.length === 0) {
      return [
        this.createClassEntry(
          content,
          department,
          day,
          timeSlot,
          roomName,
          roomCapacity,
          sapRoomId,
          '',
          '',
          ''
        ),
      ]
    }

    const entries: TimetableEntry[] = []
    for (const [program, semester, section] of programs) {
      entries.push(
        this.createClassEntry(
          content,
          department,
          day,
          timeSlot,
          roomName,
          roomCapacity,
          sapRoomId,
          program,
          semester,
          section
        )
      )
    }
    return entries
  }

  private postProcessEntries(entries: TimetableEntry[]): TimetableEntry[] {
    const seen = new Set<string>()
    const unique: TimetableEntry[] = []
    for (const e of entries) {
      const key = [
        e.department,
        e.program,
        e.semester,
        e.section,
        e.subject,
        e.time_slot,
        e.room_name,
      ].join('|')
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(e)
      }
    }
    return unique
  }

  private convertRomanToNumeric(roman: string): string {
    if (!roman) return ''
    const up = roman.toUpperCase().trim()
    if (/^\d+$/.test(up)) return up
    return this.romanNumerals[up] || roman
  }
}

export function parseTimetableCsv(csv: string): TimetableEntry[] {
  const parser = new AdvancedTimetableParser()
  return parser.parse(csv)
}
