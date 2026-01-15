import { describe, it, expect, vi, beforeEach } from 'vitest'

interface ExtractedDate {
  text_span: string
  normalized_date: string
  category: 'exam' | 'quiz' | 'assignment_due' | 'class_session' | 'holiday' | 'other'
  description: string
}

const mockOpenAIResponse = (dates: ExtractedDate[]) => ({
  choices: [{
    message: {
      content: JSON.stringify({ dates })
    }
  }]
})

global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Syllabus Date Extraction', () => {
  const MOCK_API_KEY = 'sk-test-key-123'

  describe('Date Format Validation', () => {
    it('should extract dates in YYYYMMDD format', async () => {
      const syllabusText = `
CS 101 - Introduction to Computer Science
Spring 2025

EXAM SCHEDULE:
Midterm Exam: March 15, 2025
Final Exam: May 10, 2025
`

      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Midterm Exam: March 15, 2025',
          normalized_date: '20250315',
          category: 'exam',
          description: 'Midterm Exam'
        },
        {
          text_span: 'Final Exam: May 10, 2025',
          normalized_date: '20250510',
          category: 'exam',
          description: 'Final Exam'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument(syllabusText, MOCK_API_KEY)

      expect(result).toHaveLength(2)
      expect(result[0].normalized_date).toMatch(/^\d{8}$/)
      expect(result[0].normalized_date).toBe('20250315')
      expect(result[1].normalized_date).toBe('20250510')
    })

    it('should reject invalid date formats', async () => {
      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Exam: March 15',
          normalized_date: '2025-03-15',
          category: 'exam',
          description: 'Midterm'
        } as any,
        {
          text_span: 'Quiz: April 5',
          normalized_date: '20250405',
          category: 'quiz',
          description: 'Quiz 1'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const syllabusText = 'Exam: March 15, Quiz: April 5'
      const result = await extractDatesFromDocument(syllabusText, MOCK_API_KEY)

      expect(result).toHaveLength(1)
      expect(result[0].normalized_date).toBe('20250405')
    })
  })

  describe('Category Validation', () => {
    it('should extract all valid categories', async () => {
      const syllabusText = `
COURSE SCHEDULE:

Week 1 (Jan 15): Introduction
Midterm Exam: March 1, 2025
Quiz 1: February 10, 2025
Assignment 1 due: January 25, 2025
Spring Break: March 15-22, 2025
`

      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Week 1 (Jan 15): Introduction',
          normalized_date: '20250115',
          category: 'class_session',
          description: 'Week 1 Introduction'
        },
        {
          text_span: 'Midterm Exam: March 1, 2025',
          normalized_date: '20250301',
          category: 'exam',
          description: 'Midterm Exam'
        },
        {
          text_span: 'Quiz 1: February 10, 2025',
          normalized_date: '20250210',
          category: 'quiz',
          description: 'Quiz 1'
        },
        {
          text_span: 'Assignment 1 due: January 25, 2025',
          normalized_date: '20250125',
          category: 'assignment_due',
          description: 'Assignment 1 due'
        },
        {
          text_span: 'Spring Break: March 15-22, 2025',
          normalized_date: '20250315',
          category: 'holiday',
          description: 'Spring Break'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument(syllabusText, MOCK_API_KEY)

      expect(result).toHaveLength(5)
      expect(result.map(d => d.category)).toContain('exam')
      expect(result.map(d => d.category)).toContain('quiz')
      expect(result.map(d => d.category)).toContain('assignment_due')
      expect(result.map(d => d.category)).toContain('class_session')
      expect(result.map(d => d.category)).toContain('holiday')
    })

    it('should reject invalid categories', async () => {
      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Something',
          normalized_date: '20250115',
          category: 'invalid_category' as any,
          description: 'Test'
        },
        {
          text_span: 'Valid exam',
          normalized_date: '20250120',
          category: 'exam',
          description: 'Exam'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument('test text', MOCK_API_KEY)

      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('exam')
    })
  })

  describe('Exam Dates Extraction', () => {
    it('should extract multiple exam dates', async () => {
      const syllabusText = `
EXAM SCHEDULE:
Midterm 1: February 15, 2025 at 2:00 PM in Room 101
Midterm 2: March 29, 2025 at 2:00 PM in Room 101
Final Exam: May 5, 2025 at 10:00 AM in Main Hall
`

      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Midterm 1: February 15, 2025 at 2:00 PM in Room 101',
          normalized_date: '20250215',
          category: 'exam',
          description: 'Midterm 1'
        },
        {
          text_span: 'Midterm 2: March 29, 2025 at 2:00 PM in Room 101',
          normalized_date: '20250329',
          category: 'exam',
          description: 'Midterm 2'
        },
        {
          text_span: 'Final Exam: May 5, 2025 at 10:00 AM in Main Hall',
          normalized_date: '20250505',
          category: 'exam',
          description: 'Final Exam'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument(syllabusText, MOCK_API_KEY)

      expect(result).toHaveLength(3)
      expect(result.every(d => d.category === 'exam')).toBe(true)
      expect(result[0].description).toBe('Midterm 1')
      expect(result[2].description).toBe('Final Exam')
    })
  })

  describe('Quiz Dates Extraction', () => {
    it('should extract quiz dates', async () => {
      const syllabusText = `
QUIZ SCHEDULE:
Quiz 1: January 20, 2025
Quiz 2: February 3, 2025
Quiz 3: February 17, 2025
Pop quizzes may occur unannounced
`

      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Quiz 1: January 20, 2025',
          normalized_date: '20250120',
          category: 'quiz',
          description: 'Quiz 1'
        },
        {
          text_span: 'Quiz 2: February 3, 2025',
          normalized_date: '20250203',
          category: 'quiz',
          description: 'Quiz 2'
        },
        {
          text_span: 'Quiz 3: February 17, 2025',
          normalized_date: '20250217',
          category: 'quiz',
          description: 'Quiz 3'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument(syllabusText, MOCK_API_KEY)

      expect(result).toHaveLength(3)
      expect(result.every(d => d.category === 'quiz')).toBe(true)
    })
  })

  describe('Assignment Due Dates Extraction', () => {
    it('should extract assignment due dates', async () => {
      const syllabusText = `
ASSIGNMENTS:
- Problem Set 1 due January 25, 2025 at 11:59 PM
- Lab Report 1 due February 8, 2025
- Project Proposal due March 1, 2025
- Final Project due May 1, 2025 at 11:59 PM
`

      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Problem Set 1 due January 25, 2025 at 11:59 PM',
          normalized_date: '20250125',
          category: 'assignment_due',
          description: 'Problem Set 1 due'
        },
        {
          text_span: 'Lab Report 1 due February 8, 2025',
          normalized_date: '20250208',
          category: 'assignment_due',
          description: 'Lab Report 1 due'
        },
        {
          text_span: 'Project Proposal due March 1, 2025',
          normalized_date: '20250301',
          category: 'assignment_due',
          description: 'Project Proposal due'
        },
        {
          text_span: 'Final Project due May 1, 2025 at 11:59 PM',
          normalized_date: '20250501',
          category: 'assignment_due',
          description: 'Final Project due'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument(syllabusText, MOCK_API_KEY)

      expect(result).toHaveLength(4)
      expect(result.every(d => d.category === 'assignment_due')).toBe(true)
      expect(result[0].description).toContain('Problem Set 1')
      expect(result[3].description).toContain('Final Project')
    })
  })

  describe('Class Session Dates Extraction', () => {
    it('should extract class meeting dates', async () => {
      const syllabusText = `
WEEKLY SCHEDULE:
Week 1 - January 15: Course Introduction
Week 2 - January 22: Data Structures
Week 3 - January 29: Algorithms
Classes meet every Monday and Wednesday from 2:00-3:15 PM
`

      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Week 1 - January 15: Course Introduction',
          normalized_date: '20250115',
          category: 'class_session',
          description: 'Week 1 Course Introduction'
        },
        {
          text_span: 'Week 2 - January 22: Data Structures',
          normalized_date: '20250122',
          category: 'class_session',
          description: 'Week 2 Data Structures'
        },
        {
          text_span: 'Week 3 - January 29: Algorithms',
          normalized_date: '20250129',
          category: 'class_session',
          description: 'Week 3 Algorithms'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument(syllabusText, MOCK_API_KEY)

      expect(result).toHaveLength(3)
      expect(result.every(d => d.category === 'class_session')).toBe(true)
    })
  })

  describe('Deduplication', () => {
    it('should remove duplicate dates with same description', async () => {
      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Midterm: March 15',
          normalized_date: '20250315',
          category: 'exam',
          description: 'Midterm Exam'
        },
        {
          text_span: 'Midterm exam: March 15, 2025',
          normalized_date: '20250315',
          category: 'exam',
          description: 'Midterm Exam'
        },
        {
          text_span: 'Final: May 10',
          normalized_date: '20250510',
          category: 'exam',
          description: 'Final Exam'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument('test text', MOCK_API_KEY)

      expect(result).toHaveLength(2)
      expect(result[0].normalized_date).toBe('20250315')
      expect(result[1].normalized_date).toBe('20250510')
    })

    it('should remove similar dates using fuzzy matching', async () => {
      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Assignment 1',
          normalized_date: '20250125',
          category: 'assignment_due',
          description: 'Programming Assignment 1'
        },
        {
          text_span: 'Assignment 1',
          normalized_date: '20250125',
          category: 'assignment_due',
          description: 'Programming Assignment One'
        },
        {
          text_span: 'Assignment 2',
          normalized_date: '20250210',
          category: 'assignment_due',
          description: 'Programming Assignment 2'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument('test text', MOCK_API_KEY)

      expect(result.length).toBeLessThanOrEqual(2)
    })
  })

  describe('Chronological Sorting', () => {
    it('should sort dates chronologically', async () => {
      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Final',
          normalized_date: '20250510',
          category: 'exam',
          description: 'Final Exam'
        },
        {
          text_span: 'Quiz',
          normalized_date: '20250115',
          category: 'quiz',
          description: 'Quiz 1'
        },
        {
          text_span: 'Midterm',
          normalized_date: '20250315',
          category: 'exam',
          description: 'Midterm'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument('test text', MOCK_API_KEY)

      expect(result[0].normalized_date).toBe('20250115')
      expect(result[1].normalized_date).toBe('20250315')
      expect(result[2].normalized_date).toBe('20250510')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty text', async () => {
      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument('', MOCK_API_KEY)
      expect(result).toHaveLength(0)
    })

    it('should handle very short text', async () => {
      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument('CS 101', MOCK_API_KEY)
      expect(result).toHaveLength(0)
    })

    it('should handle API errors gracefully', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ error: { message: 'API Error' } })
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      await expect(
        extractDatesFromDocument('test text', MOCK_API_KEY)
      ).rejects.toThrow()
    })

    it('should handle missing required fields', async () => {
      const mockDates: any[] = [
        {
          text_span: 'Exam',
          normalized_date: '20250315',
          category: 'exam'
        },
        {
          normalized_date: '20250320',
          category: 'quiz',
          description: 'Quiz'
        },
        {
          text_span: 'Assignment',
          normalized_date: '20250325',
          category: 'assignment_due',
          description: 'Assignment 1'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument('test text', MOCK_API_KEY)

      expect(result).toHaveLength(1)
      expect(result[0].normalized_date).toBe('20250325')
    })
  })

  describe('Document Chunking', () => {
    it('should handle large documents by chunking', async () => {
      const largeSyllabus = `
CS 101 - Introduction to Computer Science
Spring 2025

${'Week 1: Introduction\n'.repeat(100)}

EXAM SCHEDULE:
Midterm: March 15, 2025
Final: May 10, 2025
`

      const mockDates: ExtractedDate[] = [
        {
          text_span: 'Midterm: March 15, 2025',
          normalized_date: '20250315',
          category: 'exam',
          description: 'Midterm'
        },
        {
          text_span: 'Final: May 10, 2025',
          normalized_date: '20250510',
          category: 'exam',
          description: 'Final Exam'
        }
      ]

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockOpenAIResponse(mockDates)
      })

      const { extractDatesFromDocument } = await import('../lib/syllabus-date-extractor')
      const result = await extractDatesFromDocument(largeSyllabus, MOCK_API_KEY, {
        chunkSize: 500
      })

      expect(result.length).toBeGreaterThan(0)
      expect(global.fetch).toHaveBeenCalled()
    })
  })
})
