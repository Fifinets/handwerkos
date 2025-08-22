/**
 * Berechnet die Anzahl der Arbeitstage in einem Monat (ohne Wochenenden)
 * Später können hier auch Feiertage berücksichtigt werden
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  let workingDays = 0;
  
  for (let day = firstDay.getDate(); day <= lastDay.getDate(); day++) {
    const currentDay = new Date(year, month, day);
    const dayOfWeek = currentDay.getDay();
    
    // 0 = Sonntag, 6 = Samstag
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  
  return workingDays;
}

/**
 * Berechnet die maximalen Arbeitsstunden in einem Monat
 * @param year Jahr
 * @param month Monat (0-11)
 * @param hoursPerDay Arbeitsstunden pro Tag (Standard: 8)
 */
export function getMaxWorkingHoursInMonth(
  year: number, 
  month: number, 
  hoursPerDay: number = 8
): number {
  const workingDays = getWorkingDaysInMonth(year, month);
  return workingDays * hoursPerDay;
}

/**
 * Deutsche Feiertage (kann später erweitert werden)
 */
export function getGermanHolidays(year: number): Date[] {
  const holidays: Date[] = [
    new Date(year, 0, 1),   // Neujahr
    new Date(year, 0, 6),   // Heilige Drei Könige (nur in manchen Bundesländern)
    new Date(year, 4, 1),   // Tag der Arbeit
    new Date(year, 9, 3),   // Tag der Deutschen Einheit
    new Date(year, 11, 25), // 1. Weihnachtstag
    new Date(year, 11, 26), // 2. Weihnachtstag
  ];
  
  // Ostern und andere bewegliche Feiertage könnten hier ergänzt werden
  
  return holidays;
}

/**
 * Berechnet Arbeitstage mit Berücksichtigung von Feiertagen
 */
export function getWorkingDaysInMonthWithHolidays(
  year: number, 
  month: number,
  includeHolidays: boolean = false
): number {
  let workingDays = getWorkingDaysInMonth(year, month);
  
  if (includeHolidays) {
    const holidays = getGermanHolidays(year);
    
    holidays.forEach(holiday => {
      if (holiday.getMonth() === month && 
          holiday.getDay() !== 0 && 
          holiday.getDay() !== 6) {
        workingDays--;
      }
    });
  }
  
  return Math.max(0, workingDays);
}

/**
 * Gibt Monatsinfo mit Arbeitstagen zurück
 */
export function getMonthWorkInfo(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const workingDays = getWorkingDaysInMonth(year, month);
  const maxHours = workingDays * 8;
  
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  
  return {
    year,
    month,
    monthName: monthNames[month],
    workingDays,
    maxHours,
    startDate: new Date(year, month, 1),
    endDate: new Date(year, month + 1, 0)
  };
}