import { useState, useRef, useEffect } from 'react';
import { IconCalendar, IconChevronLeft, IconChevronRight, IconChevronDown, IconX } from './Icons';

export interface YearPickerProps {
  value: string;
  onChange: (year: string) => void;
  placeholder?: string;
  labelPrefix?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function YearPicker({
  value,
  onChange,
  placeholder = 'Semua Tahun',
  labelPrefix = 'Tahun ',
  className = '',
  style,
}: YearPickerProps) {
  const currentRealYear = new Date().getFullYear();
  const selectedYearNum = value ? parseInt(value, 10) : null;

  // 12 years per page (3 columns x 4 rows)
  const calculateStartYear = (y: number | null) => {
    const base = y && !isNaN(y) ? y : currentRealYear;
    // Align to decade or 12-year window (e.g. 2020)
    return Math.floor(base / 10) * 10;
  };

  const [isOpen, setIsOpen] = useState(false);
  const [startYear, setStartYear] = useState(() => calculateStartYear(selectedYearNum));
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync startYear when value changes externally
  useEffect(() => {
    if (selectedYearNum && !isNaN(selectedYearNum)) {
      setStartYear(calculateStartYear(selectedYearNum));
    }
  }, [value]);

  // Click outside and escape handling
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const years = Array.from({ length: 12 }, (_, i) => startYear + i);

  const handleSelect = (y: number) => {
    onChange(String(y));
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  const handleThisYear = () => {
    onChange(String(currentRealYear));
    setIsOpen(false);
  };

  const displayText = value ? `${labelPrefix}${value}` : placeholder;

  return (
    <div
      ref={containerRef}
      className={`year-picker-container ${className}`}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className={`year-picker-trigger ${value ? 'has-value' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <IconCalendar size={15} className="year-picker-cal-icon" />
        <span className="year-picker-text">{displayText}</span>
        {value ? (
          <span
            className="year-picker-clear-btn"
            title="Hapus filter tahun"
            onClick={handleClear}
            role="button"
            tabIndex={-1}
          >
            <IconX size={13} />
          </span>
        ) : (
          <IconChevronDown
            size={14}
            className={`year-picker-chevron ${isOpen ? 'open' : ''}`}
          />
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="year-picker-popover" role="dialog" aria-label="Pilih tahun">
          {/* Header Navigation */}
          <div className="year-picker-header">
            <button
              type="button"
              className="year-nav-btn"
              onClick={() => setStartYear((prev) => prev - 12)}
              title="12 tahun sebelumnya"
            >
              <IconChevronLeft size={16} />
            </button>
            <span className="year-picker-range">
              {startYear} – {startYear + 11}
            </span>
            <button
              type="button"
              className="year-nav-btn"
              onClick={() => setStartYear((prev) => prev + 12)}
              title="12 tahun berikutnya"
            >
              <IconChevronRight size={16} />
            </button>
          </div>

          {/* Grid Kotak Tahun */}
          <div className="year-picker-grid">
            {years.map((y) => {
              const isSelected = selectedYearNum === y;
              const isCurrent = currentRealYear === y;

              return (
                <button
                  key={y}
                  type="button"
                  className={`year-tile ${isSelected ? 'selected' : ''} ${isCurrent ? 'current-year' : ''}`}
                  onClick={() => handleSelect(y)}
                >
                  <span className="year-tile-number">{y}</span>
                  {isCurrent && !isSelected ? <span className="year-tile-dot" title="Tahun Sekarang" /> : null}
                </button>
              );
            })}
          </div>

          {/* Footer Shortcuts */}
          <div className="year-picker-footer">
            <button
              type="button"
              className="year-picker-footer-btn"
              onClick={handleClear}
            >
              Semua Tahun
            </button>
            <button
              type="button"
              className="year-picker-footer-btn highlight"
              onClick={handleThisYear}
            >
              Tahun Ini ({currentRealYear})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

