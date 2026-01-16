import { CalendarEvent } from './calendar-events'
import { Task, TaskWithList } from './tasks'
import { Goal, GoalWithTasks } from './goals'
import { TaskList } from './task-lists'
import { getCalendarEvents } from './calendar-events'
import { getTasks } from './tasks'
import { getGoals } from './goals'
import { getTaskLists } from './task-lists'

export type ExportDataTypes = {
  calendarEvents: boolean
  tasks: boolean
  goals: boolean
  taskLists: boolean
}

export type ExportOptions = {
  startDate?: string
  endDate?: string
  includeCompleted: boolean
  dataTypes: ExportDataTypes
}

// CSV Export Functions
export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    return
  }

  // Get headers from first object
  const headers = Object.keys(data[0])
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Handle null, undefined, and objects
        if (value === null || value === undefined) return ''
        if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""')
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        const stringValue = String(value).replace(/"/g, '""')
        return stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')
          ? `"${stringValue}"`
          : stringValue
      }).join(',')
    )
  ].join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportCalendarEventsToCSV(
  userId: string,
  options: ExportOptions
): Promise<void> {
  let events = await getCalendarEvents(
    userId,
    options.startDate,
    options.endDate
  )

  if (!options.includeCompleted) {
    events = events.filter(e => !e.is_completed)
  }

  if (events.length === 0) {
    return
  }

  // Flatten data for CSV
  const csvData = events.map(event => ({
    id: event.id,
    title: event.title,
    description: event.description || '',
    event_date: event.event_date,
    start_time: event.start_time || '',
    end_time: event.end_time || '',
    location: event.location || '',
    category: event.category,
    priority: event.priority,
    source: event.source,
    is_completed: event.is_completed,
    created_at: event.created_at,
    updated_at: event.updated_at,
  }))

  exportToCSV(csvData, `calendar-events-${new Date().toISOString().split('T')[0]}`)
}

export async function exportTasksToCSV(
  userId: string,
  options: ExportOptions
): Promise<void> {
  const tasks = await getTasks(userId)

  let filteredTasks = tasks

  // Apply date filter if provided
  if (options.startDate || options.endDate) {
    filteredTasks = tasks.filter(task => {
      if (!task.due_date) return false
      if (options.startDate && task.due_date < options.startDate) return false
      if (options.endDate && task.due_date > options.endDate) return false
      return true
    })
  }

  // Filter completed if needed
  if (!options.includeCompleted) {
    filteredTasks = filteredTasks.filter(t => !t.is_completed)
  }

  if (filteredTasks.length === 0) {
    return
  }

  // Flatten data for CSV
  const csvData = filteredTasks.map(task => ({
    id: task.id,
    list_name: task.task_lists?.name || '',
    title: task.title,
    notes: task.notes || '',
    due_date: task.due_date || '',
    due_time: task.due_time || '',
    is_completed: task.is_completed,
    is_starred: task.is_starred,
    priority: task.priority,
    progress: task.progress,
    estimated_hours: task.estimated_hours || '',
    goal: task.goal || '',
    location: task.location || '',
    created_at: task.created_at,
    updated_at: task.updated_at,
  }))

  exportToCSV(csvData, `tasks-${new Date().toISOString().split('T')[0]}`)
}

export async function exportGoalsToCSV(
  userId: string,
  options: ExportOptions
): Promise<void> {
  const goals = await getGoals(userId)

  if (goals.length === 0) {
    return
  }

  // Flatten goals with their tasks
  const csvData: any[] = []
  goals.forEach(goal => {
    if (goal.tasks.length === 0) {
      csvData.push({
        goal_id: goal.id,
        goal_title: goal.title,
        goal_description: goal.description,
        goal_category: goal.category,
        goal_priority: goal.priority,
        goal_progress: goal.progress,
        goal_target_date: goal.target_date || '',
        task_id: '',
        task_title: '',
        task_completed: '',
        task_priority: '',
        task_due_date: '',
        task_estimated_hours: '',
      })
    } else {
      goal.tasks.forEach(task => {
        csvData.push({
          goal_id: goal.id,
          goal_title: goal.title,
          goal_description: goal.description,
          goal_category: goal.category,
          goal_priority: goal.priority,
          goal_progress: goal.progress,
          goal_target_date: goal.target_date || '',
          task_id: task.id,
          task_title: task.title,
          task_completed: task.completed,
          task_priority: task.priority,
          task_due_date: task.due_date || '',
          task_estimated_hours: task.estimated_hours || '',
        })
      })
    }
  })

  exportToCSV(csvData, `goals-${new Date().toISOString().split('T')[0]}`)
}

export async function exportTaskListsToCSV(
  userId: string,
  options: ExportOptions
): Promise<void> {
  const taskLists = await getTaskLists(userId)

  if (taskLists.length === 0) {
    return
  }

  const csvData = taskLists.map(list => ({
    id: list.id,
    name: list.name,
    color: list.color,
    is_visible: list.is_visible,
    position: list.position,
    created_at: list.created_at,
    updated_at: list.updated_at,
  }))

  exportToCSV(csvData, `task-lists-${new Date().toISOString().split('T')[0]}`)
}

// PDF Export Functions
export async function exportToPDF(
  userId: string,
  options: ExportOptions
): Promise<void> {
  // Dynamic import to handle cases where package might not be installed
  let jsPDF: any
  let autoTable: any
  
  try {
    // Import jsPDF
    const jsPDFModule = await import('jspdf')
    jsPDF = jsPDFModule.default || jsPDFModule.jsPDF || jsPDFModule
    console.log('jsPDF loaded:', typeof jsPDF, jsPDF)
    
    // Import jspdf-autotable - for v3.8, it exports autoTable as named or default
    const autoTableModule = await import('jspdf-autotable')
    console.log('autoTableModule keys:', Object.keys(autoTableModule))
    
    // Try different ways to get autoTable function
    if (typeof autoTableModule.autoTable === 'function') {
      autoTable = autoTableModule.autoTable
    } else if (typeof autoTableModule.default === 'function') {
      autoTable = autoTableModule.default
    } else if (typeof autoTableModule === 'function') {
      autoTable = autoTableModule
    } else {
      // Try to access it from the module
      const mod = autoTableModule as any
      autoTable = mod.autoTable || mod.default || mod
    }
    
    console.log('autoTable type:', typeof autoTable)
    console.log('autoTable function:', autoTable)
    
    if (typeof autoTable !== 'function') {
      console.error('autoTable is not a function. Module:', autoTableModule)
      throw new Error('autoTable is not a function. Check jspdf-autotable installation.')
    }
  } catch (error) {
    console.error('PDF export error:', error)
    throw new Error('PDF export requires jspdf and jspdf-autotable packages. Please install them: pnpm add jspdf jspdf-autotable')
  }

  const doc = new jsPDF()
  
  let yPosition = 20

  // Title
  doc.setFontSize(18)
  doc.text('Data Export Report', 14, yPosition)
  yPosition += 10

  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPosition)
  yPosition += 15

  // Export Calendar Events
  if (options.dataTypes.calendarEvents) {
    console.log('Exporting calendar events to PDF...')
    yPosition = await addCalendarEventsSection(doc, userId, options, yPosition, autoTable)
    console.log('Calendar events section completed, yPosition:', yPosition)
    // Validate yPosition after each section
    if (!yPosition || isNaN(yPosition)) {
      yPosition = 20
      doc.addPage()
    }
  }

  // Export Tasks
  if (options.dataTypes.tasks) {
    console.log('Exporting tasks to PDF...')
    yPosition = await addTasksSection(doc, userId, options, yPosition, autoTable)
    console.log('Tasks section completed, yPosition:', yPosition)
    if (!yPosition || isNaN(yPosition)) {
      yPosition = 20
      doc.addPage()
    }
  }

  // Export Goals
  if (options.dataTypes.goals) {
    console.log('Exporting goals to PDF...')
    yPosition = await addGoalsSection(doc, userId, options, yPosition, autoTable)
    console.log('Goals section completed, yPosition:', yPosition)
    if (!yPosition || isNaN(yPosition)) {
      yPosition = 20
      doc.addPage()
    }
  }

  // Export Task Lists
  if (options.dataTypes.taskLists) {
    console.log('Exporting task lists to PDF...')
    yPosition = await addTaskListsSection(doc, userId, options, yPosition, autoTable)
    console.log('Task lists section completed, yPosition:', yPosition)
    if (!yPosition || isNaN(yPosition)) {
      yPosition = 20
      doc.addPage()
    }
  }

  // Calendar View Section
  if (options.dataTypes.calendarEvents) {
    console.log('Adding calendar view to PDF...')
    yPosition = await addCalendarViewSection(doc, userId, options, yPosition)
    console.log('Calendar view section completed, yPosition:', yPosition)
    if (!yPosition || isNaN(yPosition)) {
      yPosition = 20
    }
  }
  
  console.log('PDF generation completed. Final yPosition:', yPosition)

  // Save PDF
  const filename = `data-export-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

async function addCalendarEventsSection(
  doc: any,
  userId: string,
  options: ExportOptions,
  yPosition: number,
  autoTable: any
): Promise<number> {
  try {
    let events = await getCalendarEvents(userId, options.startDate, options.endDate)
    console.log('Calendar events fetched:', events.length)
    
    if (!options.includeCompleted) {
      events = events.filter(e => !e.is_completed)
      console.log('After filtering completed:', events.length)
    }

    if (events.length === 0) {
      // Add a message indicating no events found
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
      doc.setFontSize(12)
      doc.text('Calendar Events', 14, yPosition)
      yPosition += 8
      doc.setFontSize(10)
      doc.text('No calendar events found for the selected criteria.', 14, yPosition)
      return yPosition + 10
    }

  // Check if we need a new page
  if (yPosition > 250) {
    doc.addPage()
    yPosition = 20
  }

  doc.setFontSize(14)
  doc.text('Calendar Events', 14, yPosition)
  yPosition += 8

  const tableData = events.map(event => [
    event.title,
    event.event_date,
    event.start_time || '',
    event.end_time || '',
    event.category,
    event.priority,
    event.is_completed ? 'Yes' : 'No',
  ])

    console.log('Calling autoTable with', tableData.length, 'rows')
    console.log('Table data sample:', tableData.slice(0, 2))
    
    try {
      autoTable(doc, {
        head: [['Title', 'Date', 'Start', 'End', 'Category', 'Priority', 'Completed']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
      })
      
      const finalY = (doc as any).lastAutoTable?.finalY
      console.log('autoTable completed, finalY:', finalY)
      
      if (finalY && !isNaN(finalY) && finalY > yPosition) {
        return finalY + 10
      } else {
        // Fallback: if autoTable didn't work, add data manually
        console.warn('autoTable may have failed, using fallback rendering for calendar events')
        yPosition += 20
        doc.setFontSize(10)
        // Add header
        doc.setFontSize(9)
        doc.text('Title | Date | Start | End | Category | Priority | Completed', 14, yPosition)
        yPosition += 8
        doc.setFontSize(8)
        // Add all rows
        tableData.forEach((row: any[]) => {
          if (yPosition > 280) {
            doc.addPage()
            yPosition = 20
          }
          const rowText = row.map(cell => String(cell || '')).join(' | ')
          // Truncate if too long
          const maxWidth = 180
          if (rowText.length > maxWidth) {
            doc.text(rowText.substring(0, maxWidth) + '...', 14, yPosition)
          } else {
            doc.text(rowText, 14, yPosition)
          }
          yPosition += 6
        })
        return yPosition + 10
      }
    } catch (tableError) {
      console.error('Calendar events autoTable error:', tableError)
      // Fallback rendering
      yPosition += 20
      doc.setFontSize(9)
      doc.text('Title | Date | Start | End | Category | Priority | Completed', 14, yPosition)
      yPosition += 8
      doc.setFontSize(8)
      tableData.forEach((row: any[]) => {
        if (yPosition > 280) {
          doc.addPage()
          yPosition = 20
        }
        const rowText = row.map(cell => String(cell || '')).join(' | ')
        const maxWidth = 180
        if (rowText.length > maxWidth) {
          doc.text(rowText.substring(0, maxWidth) + '...', 14, yPosition)
        } else {
          doc.text(rowText, 14, yPosition)
        }
        yPosition += 6
      })
      return yPosition + 10
    }
  } catch (error) {
    console.error('Error adding calendar events section:', error)
    // Add error message to PDF
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }
    doc.setFontSize(12)
    doc.text('Calendar Events', 14, yPosition)
    yPosition += 8
    doc.setFontSize(10)
    doc.setTextColor(255, 0, 0)
    doc.text('Error loading calendar events.', 14, yPosition)
    doc.setTextColor(0, 0, 0)
    return yPosition + 10
  }
}

async function addTasksSection(
  doc: any,
  userId: string,
  options: ExportOptions,
  yPosition: number,
  autoTable: any
): Promise<number> {
  try {
    const tasks = await getTasks(userId)
    
    let filteredTasks = tasks

    if (options.startDate || options.endDate) {
      filteredTasks = tasks.filter(task => {
        if (!task.due_date) return false
        if (options.startDate && task.due_date < options.startDate) return false
        if (options.endDate && task.due_date > options.endDate) return false
        return true
      })
    }

    if (!options.includeCompleted) {
      filteredTasks = filteredTasks.filter(t => !t.is_completed)
    }

    if (filteredTasks.length === 0) {
      // Add a message indicating no tasks found
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
      doc.setFontSize(12)
      doc.text('Tasks', 14, yPosition)
      yPosition += 8
      doc.setFontSize(10)
      doc.text('No tasks found for the selected criteria.', 14, yPosition)
      return yPosition + 10
    }

  if (yPosition > 250) {
    doc.addPage()
    yPosition = 20
  }

  doc.setFontSize(14)
  doc.text('Tasks', 14, yPosition)
  yPosition += 8

  const tableData = filteredTasks.map(task => [
    task.title,
    task.task_lists?.name || '',
    task.due_date || '',
    task.priority,
    `${task.progress}%`,
    task.is_completed ? 'Yes' : 'No',
  ])

    console.log('Calling autoTable for tasks with', tableData.length, 'rows')
    
    try {
      autoTable(doc, {
        head: [['Title', 'List', 'Due Date', 'Priority', 'Progress', 'Completed']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
      })

      const finalY = (doc as any).lastAutoTable?.finalY
      console.log('Tasks autoTable completed, finalY:', finalY)
      
      if (finalY && !isNaN(finalY) && finalY > yPosition) {
        return finalY + 10
      } else {
        // Fallback rendering for tasks
        console.warn('autoTable may have failed, using fallback rendering for tasks')
        yPosition += 20
        doc.setFontSize(9)
        doc.text('Title | List | Due Date | Priority | Progress | Completed', 14, yPosition)
        yPosition += 8
        doc.setFontSize(8)
        tableData.forEach((row: any[]) => {
          if (yPosition > 280) {
            doc.addPage()
            yPosition = 20
          }
          const rowText = row.map(cell => String(cell || '')).join(' | ')
          const maxWidth = 180
          if (rowText.length > maxWidth) {
            doc.text(rowText.substring(0, maxWidth) + '...', 14, yPosition)
          } else {
            doc.text(rowText, 14, yPosition)
          }
          yPosition += 6
        })
        return yPosition + 10
      }
    } catch (tableError) {
      console.error('Tasks autoTable error:', tableError)
      // Fallback rendering
      yPosition += 20
      doc.setFontSize(9)
      doc.text('Title | List | Due Date | Priority | Progress | Completed', 14, yPosition)
      yPosition += 8
      doc.setFontSize(8)
      tableData.forEach((row: any[]) => {
        if (yPosition > 280) {
          doc.addPage()
          yPosition = 20
        }
        const rowText = row.map(cell => String(cell || '')).join(' | ')
        const maxWidth = 180
        if (rowText.length > maxWidth) {
          doc.text(rowText.substring(0, maxWidth) + '...', 14, yPosition)
        } else {
          doc.text(rowText, 14, yPosition)
        }
        yPosition += 6
      })
      return yPosition + 10
    }
  } catch (error) {
    console.error('Error adding tasks section:', error)
    // Add error message to PDF
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }
    doc.setFontSize(12)
    doc.text('Tasks', 14, yPosition)
    yPosition += 8
    doc.setFontSize(10)
    doc.setTextColor(255, 0, 0)
    doc.text('Error loading tasks.', 14, yPosition)
    doc.setTextColor(0, 0, 0)
    return yPosition + 10
  }
}

async function addGoalsSection(
  doc: any,
  userId: string,
  options: ExportOptions,
  yPosition: number,
  autoTable: any
): Promise<number> {
  try {
    const goals = await getGoals(userId)

    if (goals.length === 0) {
      // Add a message indicating no goals found
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
      doc.setFontSize(12)
      doc.text('Goals', 14, yPosition)
      yPosition += 8
      doc.setFontSize(10)
      doc.text('No goals found.', 14, yPosition)
      return yPosition + 10
    }

  if (yPosition > 250) {
    doc.addPage()
    yPosition = 20
  }

  doc.setFontSize(14)
  doc.text('Goals', 14, yPosition)
  yPosition += 8

  const tableData = goals.map(goal => [
    goal.title,
    goal.category,
    goal.priority,
    `${goal.progress}%`,
    goal.target_date || '',
    goal.tasks.length.toString(),
  ])

    console.log('Calling autoTable for goals with', tableData.length, 'rows')
    
    try {
      autoTable(doc, {
        head: [['Title', 'Category', 'Priority', 'Progress', 'Target Date', 'Tasks']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
      })

      const finalY = (doc as any).lastAutoTable?.finalY
      console.log('Goals autoTable completed, finalY:', finalY)
      
      if (finalY && !isNaN(finalY) && finalY > yPosition) {
        return finalY + 10
      } else {
        // Fallback rendering for goals
        console.warn('autoTable may have failed, using fallback rendering for goals')
        yPosition += 20
        doc.setFontSize(9)
        doc.text('Title | Category | Priority | Progress | Target Date | Tasks', 14, yPosition)
        yPosition += 8
        doc.setFontSize(8)
        tableData.forEach((row: any[]) => {
          if (yPosition > 280) {
            doc.addPage()
            yPosition = 20
          }
          const rowText = row.map(cell => String(cell || '')).join(' | ')
          const maxWidth = 180
          if (rowText.length > maxWidth) {
            doc.text(rowText.substring(0, maxWidth) + '...', 14, yPosition)
          } else {
            doc.text(rowText, 14, yPosition)
          }
          yPosition += 6
        })
        return yPosition + 10
      }
    } catch (tableError) {
      console.error('Goals autoTable error:', tableError)
      // Fallback rendering
      yPosition += 20
      doc.setFontSize(9)
      doc.text('Title | Category | Priority | Progress | Target Date | Tasks', 14, yPosition)
      yPosition += 8
      doc.setFontSize(8)
      tableData.forEach((row: any[]) => {
        if (yPosition > 280) {
          doc.addPage()
          yPosition = 20
        }
        const rowText = row.map(cell => String(cell || '')).join(' | ')
        const maxWidth = 180
        if (rowText.length > maxWidth) {
          doc.text(rowText.substring(0, maxWidth) + '...', 14, yPosition)
        } else {
          doc.text(rowText, 14, yPosition)
        }
        yPosition += 6
      })
      return yPosition + 10
    }
  } catch (error) {
    console.error('Error adding goals section:', error)
    // Add error message to PDF
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }
    doc.setFontSize(12)
    doc.text('Goals', 14, yPosition)
    yPosition += 8
    doc.setFontSize(10)
    doc.setTextColor(255, 0, 0)
    doc.text('Error loading goals.', 14, yPosition)
    doc.setTextColor(0, 0, 0)
    return yPosition + 10
  }
}

async function addTaskListsSection(
  doc: any,
  userId: string,
  options: ExportOptions,
  yPosition: number,
  autoTable: any
): Promise<number> {
  try {
    const taskLists = await getTaskLists(userId)

    if (taskLists.length === 0) {
      // Add a message indicating no task lists found
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
      doc.setFontSize(12)
      doc.text('Task Lists', 14, yPosition)
      yPosition += 8
      doc.setFontSize(10)
      doc.text('No task lists found.', 14, yPosition)
      return yPosition + 10
    }

  if (yPosition > 250) {
    doc.addPage()
    yPosition = 20
  }

  doc.setFontSize(14)
  doc.text('Task Lists', 14, yPosition)
  yPosition += 8

  const tableData = taskLists.map(list => [
    list.name,
    list.color,
    list.is_visible ? 'Yes' : 'No',
    list.position.toString(),
  ])

    console.log('Calling autoTable for task lists with', tableData.length, 'rows')
    
    try {
      autoTable(doc, {
        head: [['Name', 'Color', 'Visible', 'Position']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
      })

      const finalY = (doc as any).lastAutoTable?.finalY
      console.log('Task lists autoTable completed, finalY:', finalY)
      
      if (finalY && !isNaN(finalY) && finalY > yPosition) {
        return finalY + 10
      } else {
        // Fallback rendering for task lists
        console.warn('autoTable may have failed, using fallback rendering for task lists')
        yPosition += 20
        doc.setFontSize(9)
        doc.text('Name | Color | Visible | Position', 14, yPosition)
        yPosition += 8
        doc.setFontSize(8)
        tableData.forEach((row: any[]) => {
          if (yPosition > 280) {
            doc.addPage()
            yPosition = 20
          }
          const rowText = row.map(cell => String(cell || '')).join(' | ')
          doc.text(rowText, 14, yPosition)
          yPosition += 6
        })
        return yPosition + 10
      }
    } catch (tableError) {
      console.error('Task lists autoTable error:', tableError)
      // Fallback rendering
      yPosition += 20
      doc.setFontSize(9)
      doc.text('Name | Color | Visible | Position', 14, yPosition)
      yPosition += 8
      doc.setFontSize(8)
      tableData.forEach((row: any[]) => {
        if (yPosition > 280) {
          doc.addPage()
          yPosition = 20
        }
        const rowText = row.map(cell => String(cell || '')).join(' | ')
        doc.text(rowText, 14, yPosition)
        yPosition += 6
      })
      return yPosition + 10
    }
  } catch (error) {
    console.error('Error adding task lists section:', error)
    // Add error message to PDF
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }
    doc.setFontSize(12)
    doc.text('Task Lists', 14, yPosition)
    yPosition += 8
    doc.setFontSize(10)
    doc.setTextColor(255, 0, 0)
    doc.text('Error loading task lists.', 14, yPosition)
    doc.setTextColor(0, 0, 0)
    return yPosition + 10
  }
}

async function addCalendarViewSection(
  doc: any,
  userId: string,
  options: ExportOptions,
  yPosition: number
): Promise<number> {
  // Validate yPosition to prevent NaN errors
  if (!yPosition || isNaN(yPosition) || yPosition < 0) {
    yPosition = 20
  }

  let events = await getCalendarEvents(userId, options.startDate, options.endDate)
  
  if (!options.includeCompleted) {
    events = events.filter(e => !e.is_completed)
  }

  if (events.length === 0) {
    return yPosition
  }

  if (yPosition > 200) {
    doc.addPage()
    yPosition = 20
  }

  doc.setFontSize(14)
  doc.text('Calendar View', 14, yPosition)
  yPosition += 10

  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    const date = event.event_date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(event)
    return acc
  }, {} as Record<string, CalendarEvent[]>)

  // Sort dates
  const sortedDates = Object.keys(eventsByDate).sort()

  doc.setFontSize(10)
  for (const date of sortedDates) {
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }

    const dateObj = new Date(date)
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })

    doc.setFontSize(11)
    doc.text(formattedDate, 14, yPosition)
    yPosition += 7

    doc.setFontSize(9)
    for (const event of eventsByDate[date]) {
      const timeStr = event.start_time 
        ? `${event.start_time}${event.end_time ? ` - ${event.end_time}` : ''}`
        : 'All day'
      
      doc.text(`  • ${event.title}`, 16, yPosition)
      yPosition += 5
      doc.setFontSize(8)
      doc.text(`    ${timeStr} | ${event.category} | ${event.priority}`, 18, yPosition)
      yPosition += 6
      doc.setFontSize(9)
      
      if (yPosition > 270) {
        doc.addPage()
        yPosition = 20
      }
    }
    yPosition += 3
  }

  return yPosition
}
