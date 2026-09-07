"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AppointmentDatePickerProps {
  date: string;
  duration: number;
  minDate: string;
}

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function AppointmentDatePicker({ date, duration, minDate }: AppointmentDatePickerProps) {
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLAnchorElement>(null);

  // Parse active date or default to minDate
  const activeIso = useMemo(() => {
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : minDate;
  }, [date, minDate]);

  // Current year and month view state
  const [viewYear, setViewYear] = useState(() => {
    const d = new Date(`${activeIso}T12:00:00`);
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  });

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(`${activeIso}T12:00:00`);
    return isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  });

  // Keep viewYear and viewMonth synchronized when external date prop changes
  useEffect(() => {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const d = new Date(`${date}T12:00:00`);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [date]);

  // Generate all days for the currently selected viewMonth & viewYear
  const monthCards = useMemo(() => {
    const cards: Array<{
      iso: string;
      dayName: string;
      monthName: string;
      dayNum: number;
      isSunday: boolean;
      isToday: boolean;
      isPast: boolean;
    }> = [];

    const pad = (n: number) => String(n).padStart(2, "0");
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    // Get number of days in viewMonth of viewYear
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
      const d = new Date(`${iso}T12:00:00`);
      const dayOfWeek = d.getDay();
      const isSunday = dayOfWeek === 0;
      const isToday = iso === todayIso;
      const dayName = isToday ? "Today" : DAYS_SHORT[dayOfWeek];
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      const isPast = iso < minDate;

      cards.push({ iso, dayName: dayName ?? "", monthName, dayNum: day, isSunday, isToday, isPast });
    }

    return cards;
  }, [viewYear, viewMonth, minDate]);

  // Scroll selected date card into center of carousel
  useEffect(() => {
    if (selectedCardRef.current && carouselRef.current) {
      selectedCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [date, viewMonth, viewYear]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    router.push(`/clinic/schedule/new?date=${iso}&duration=${duration}`);
  };

  const handleCustomDateChange = (newDate: string) => {
    if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      const d = new Date(`${newDate}T12:00:00`);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
      router.push(`/clinic/schedule/new?date=${newDate}&duration=${duration}`);
    }
  };

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -280, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 280, behavior: "smooth" });
    }
  };

  const currentYearNum = new Date().getFullYear();
  const yearOptions = [currentYearNum - 1, currentYearNum, currentYearNum + 1, currentYearNum + 2, currentYearNum + 3];

  return (
    <div className="field" style={{ minWidth: 0, width: "100%" }}>
      {/* Calendar Navigation Header */}
      <div className="calendar-header-bar">
        <div className="calendar-month-title">
          <button
            type="button"
            className="btn btn-ghost btn-sm month-nav-btn"
            onClick={handlePrevMonth}
            aria-label="Previous month"
          >
            <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
              <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
            </svg>
          </button>

          <h3 className="month-heading" style={{ margin: 0, font: "var(--title-md)", fontWeight: 600 }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>

          <button
            type="button"
            className="btn btn-ghost btn-sm month-nav-btn"
            onClick={handleNextMonth}
            aria-label="Next month"
          >
            <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
              <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
            </svg>
          </button>
        </div>

        {/* Quick Actions & Month/Year Selectors */}
        <div className="calendar-controls-group">
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="select select-sm"
            aria-label="Select month"
            style={{ width: "auto" }}
          >
            {MONTH_NAMES.map((mName, idx) => (
              <option key={mName} value={idx}>
                {mName}
              </option>
            ))}
          </select>

          <select
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="select select-sm"
            aria-label="Select year"
            style={{ width: "auto" }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button type="button" className="btn btn-secondary btn-sm" onClick={handleGoToday}>
            Today
          </button>

          <div className="custom-date-field" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              id="custom-date-input"
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => handleCustomDateChange(e.target.value)}
              className="input input-sm"
              style={{ width: "auto" }}
            />
          </div>
        </div>
      </div>

      {/* Swipeable Date Carousel Container for Current Month */}
      <div className="date-carousel-wrapper">
        <button
          type="button"
          className="btn btn-secondary btn-sm carousel-arrow arrow-left"
          onClick={scrollLeft}
          aria-label="Scroll left"
        >
          <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
            <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
          </svg>
        </button>

        <div className="apt-date-carousel" ref={carouselRef}>
          {monthCards.map((card) => {
            const isSelected = card.iso === date;
            return (
              <Link
                key={card.iso}
                ref={isSelected ? selectedCardRef : null}
                className={`apt-date-card ${isSelected ? "is-selected" : ""} ${card.isSunday ? "is-closed" : ""} ${card.isPast ? "is-past" : ""}`}
                aria-pressed={isSelected}
                href={`/clinic/schedule/new?date=${card.iso}&duration=${duration}`}
              >
                <span className="apt-date-day">{card.dayName}</span>
                <span className="apt-date-num">{card.dayNum}</span>
                <span className="apt-date-month">{card.monthName}</span>
                {card.isSunday && <span className="apt-date-badge">Closed</span>}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm carousel-arrow arrow-right"
          onClick={scrollRight}
          aria-label="Scroll right"
        >
          <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
            <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

