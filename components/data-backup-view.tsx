"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Database, Download, FileText, FileSpreadsheet, Loader2, Calendar, CheckSquare, Target, List } from "lucide-react"
import { toast } from "sonner"
import { 
  exportCalendarEventsToCSV, 
  exportTasksToCSV, 
  exportGoalsToCSV, 
  exportTaskListsToCSV,
  exportToPDF,
  type ExportDataTypes,
  type ExportOptions 
} from "@/lib/export-utils"
import { cn } from "@/lib/utils"

interface DataBackupViewProps {
  userId: string
}

export function DataBackupView({ userId }: DataBackupViewProps) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [includeCompleted, setIncludeCompleted] = useState(true)
  const [dataTypes, setDataTypes] = useState<ExportDataTypes>({
    calendarEvents: true,
    tasks: true,
    goals: true,
    taskLists: true,
  })
  const [isExporting, setIsExporting] = useState(false)

  const toggleDataType = (type: keyof ExportDataTypes) => {
    setDataTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }))
  }

  const hasAnyDataTypeSelected = Object.values(dataTypes).some(v => v)

  const handleCSVExport = async () => {
    if (!hasAnyDataTypeSelected) {
      toast.error("Please select at least one data type to export")
      return
    }

    setIsExporting(true)
    try {
      const options: ExportOptions = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        includeCompleted,
        dataTypes,
      }

      if (dataTypes.calendarEvents) {
        await exportCalendarEventsToCSV(userId, options)
      }
      if (dataTypes.tasks) {
        await exportTasksToCSV(userId, options)
      }
      if (dataTypes.goals) {
        await exportGoalsToCSV(userId, options)
      }
      if (dataTypes.taskLists) {
        await exportTaskListsToCSV(userId, options)
      }

      toast.success("CSV files exported successfully!")
    } catch (error) {
      console.error("Export error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }

  const handlePDFExport = async () => {
    if (!hasAnyDataTypeSelected) {
      toast.error("Please select at least one data type to export")
      return
    }

    setIsExporting(true)
    try {
      const options: ExportOptions = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        includeCompleted,
        dataTypes,
      }

      await exportToPDF(userId, options)
      toast.success("PDF exported successfully!")
    } catch (error) {
      console.error("Export error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to export PDF. Make sure jspdf and jspdf-autotable are installed.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-semibold">Data & Backup</h1>
          </div>
          <p className="text-muted-foreground">
            Export your calendar events, tasks, goals, and task lists to CSV or PDF format for backup and analysis.
          </p>
        </div>

        {/* Main Export Card */}
        <Card className="glass-strong border-border/50 backdrop-blur-xl rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle>Export Options</CardTitle>
            <CardDescription>
              Configure your export settings and select the data types you want to include
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Range Filters */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range (Optional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-border/50"
                  />
                </div>
              </div>
              {startDate && endDate && startDate > endDate && (
                <p className="text-sm text-destructive">Start date must be before end date</p>
              )}
            </div>

            {/* Include Completed Option */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeCompleted"
                checked={includeCompleted}
                onCheckedChange={(checked) => setIncludeCompleted(checked === true)}
              />
              <Label htmlFor="includeCompleted" className="cursor-pointer">
                Include completed items
              </Label>
            </div>

            {/* Data Type Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Select Data Types to Export</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={cn(
                    "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    dataTypes.calendarEvents
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-primary/50"
                  )}
                  onClick={() => toggleDataType("calendarEvents")}
                >
                  <Checkbox
                    id="calendarEvents"
                    checked={dataTypes.calendarEvents}
                    onCheckedChange={() => toggleDataType("calendarEvents")}
                  />
                  <div className="flex-1">
                    <Label htmlFor="calendarEvents" className="cursor-pointer flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Calendar Events
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      All your scheduled events and appointments
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    dataTypes.tasks
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-primary/50"
                  )}
                  onClick={() => toggleDataType("tasks")}
                >
                  <Checkbox
                    id="tasks"
                    checked={dataTypes.tasks}
                    onCheckedChange={() => toggleDataType("tasks")}
                  />
                  <div className="flex-1">
                    <Label htmlFor="tasks" className="cursor-pointer flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      Tasks
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      All your tasks and to-dos
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    dataTypes.goals
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-primary/50"
                  )}
                  onClick={() => toggleDataType("goals")}
                >
                  <Checkbox
                    id="goals"
                    checked={dataTypes.goals}
                    onCheckedChange={() => toggleDataType("goals")}
                  />
                  <div className="flex-1">
                    <Label htmlFor="goals" className="cursor-pointer flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Goals
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your goals and associated tasks
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    dataTypes.taskLists
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-primary/50"
                  )}
                  onClick={() => toggleDataType("taskLists")}
                >
                  <Checkbox
                    id="taskLists"
                    checked={dataTypes.taskLists}
                    onCheckedChange={() => toggleDataType("taskLists")}
                  />
                  <div className="flex-1">
                    <Label htmlFor="taskLists" className="cursor-pointer flex items-center gap-2">
                      <List className="h-4 w-4" />
                      Task Lists
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your task list configurations
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/50">
              <Button
                onClick={handleCSVExport}
                disabled={isExporting || !hasAnyDataTypeSelected || (startDate && endDate && startDate > endDate)}
                className="flex-1"
                variant="outline"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export to CSV
                  </>
                )}
              </Button>
              <Button
                onClick={handlePDFExport}
                disabled={isExporting || !hasAnyDataTypeSelected || (startDate && endDate && startDate > endDate)}
                className="flex-1"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Export to PDF
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="glass-strong border-border/50 backdrop-blur-xl rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Export Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-1">CSV Export</p>
                <p>Exports separate CSV files for each selected data type. Perfect for importing into Excel, Google Sheets, or other spreadsheet applications.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-1">PDF Export</p>
                <p>Creates a comprehensive PDF report with tables, formatted sections, and a calendar view. Great for printing or sharing as a document.</p>
              </div>
            </div>
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs">
                <strong>Note:</strong> PDF export requires the jspdf and jspdf-autotable packages. 
                If you encounter errors, run: <code className="bg-muted px-1 py-0.5 rounded">pnpm add jspdf jspdf-autotable</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
