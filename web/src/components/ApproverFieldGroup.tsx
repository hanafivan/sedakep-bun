import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { IconCheckSquare, IconUser } from './Icons';

export interface ApproverFieldGroupProps {
  title: string;
  nameLabel?: string;
  nipLabel?: string;
  positionLabel?: string;
  nameId: string;
  nipId: string;
  positionId: string;
  nameValue: string;
  nipValue: string;
  positionValue: string;
  onNameChange: (val: string) => void;
  onNipChange: (val: string) => void;
  onPositionChange: (val: string) => void;
  defaultPositionSuggestion?: string;
}

export function ApproverFieldGroup({
  title,
  nameLabel = 'Nama',
  nipLabel = 'NIP',
  positionLabel = 'Jabatan',
  nameId,
  nipId,
  positionId,
  nameValue,
  nipValue,
  positionValue,
  onNameChange,
  onNipChange,
  onPositionChange,
  defaultPositionSuggestion,
}: ApproverFieldGroupProps) {
  const [suggestions, setSuggestions] = useState<api.ApproverSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showNipDropdown, setShowNipDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLFieldSetElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nipInputRef = useRef<HTMLInputElement>(null);

  // Load suggestions from API when search term changes
  const fetchSuggestions = async (query: string) => {
    setLoading(true);
    try {
      const data = await api.getApproverSuggestions(query.trim() || undefined);
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowNameDropdown(false);
        setShowNipDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: api.ApproverSuggestion) => {
    onNameChange(item.name);
    onNipChange(item.nip || '');
    onPositionChange(item.position || defaultPositionSuggestion || '');
    setShowNameDropdown(false);
    setShowNipDropdown(false);
    setActiveIndex(-1);
  };

  // Filter local suggestions or debounce search
  const handleNameInputChange = (val: string) => {
    onNameChange(val);
    setShowNameDropdown(true);
    setShowNipDropdown(false);
    fetchSuggestions(val);
  };

  const handleNipInputChange = (val: string) => {
    onNipChange(val);
    setShowNipDropdown(true);
    setShowNameDropdown(false);
    fetchSuggestions(val);
  };

  // Keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent,
    isName: boolean,
  ) => {
    const isDropdownOpen = isName ? showNameDropdown : showNipDropdown;
    if (!isDropdownOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowNameDropdown(false);
      setShowNipDropdown(false);
    }
  };

  return (
    <fieldset
      ref={containerRef}
      className="form-fieldset"
      style={{
        marginTop: '12px',
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1px solid #cbd5e1',
        background: '#fafbfc',
        position: 'relative',
      }}
    >
      <legend
        className="form-legend"
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: '#1e293b',
          padding: '0 6px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <IconUser size={14} style={{ color: '#0E6B4C' }} />
        <span>{title}</span>
      </legend>

      <div className="grid2" style={{ position: 'relative' }}>
        {/* Kolom Nama Atasan dengan Suggestion Dropdown */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor={nameId} style={{ fontSize: '12px', fontWeight: 600 }}>
              {nameLabel}
            </label>
            <button
              type="button"
              className="button-link"
              style={{
                background: 'none',
                border: 'none',
                color: '#0E6B4C',
                fontSize: '11px',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                fontWeight: 600,
              }}
              onClick={() => {
                setShowNameDropdown(true);
                setShowNipDropdown(false);
                fetchSuggestions('');
                nameInputRef.current?.focus();
              }}
            >
              Pilih dari daftar atasan
            </button>
          </div>
          <input
            ref={nameInputRef}
            id={nameId}
            placeholder="Ketik nama atasan (ada saran list)..."
            value={nameValue}
            autoComplete="off"
            onChange={(e) => handleNameInputChange(e.target.value)}
            onFocus={() => {
              setShowNameDropdown(true);
              setShowNipDropdown(false);
              fetchSuggestions(nameValue);
            }}
            onClick={() => {
              setShowNameDropdown(true);
              setShowNipDropdown(false);
              fetchSuggestions(nameValue);
            }}
            onKeyDown={(e) => handleKeyDown(e, true)}
          />

          {/* Dropdown Suggestions untuk Nama */}
          {showNameDropdown ? (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 2px)',
                left: 0,
                right: 0,
                maxHeight: '220px',
                overflowY: 'auto',
                backgroundColor: '#ffffff',
                border: '1px solid #94a3b8',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                zIndex: 100,
              }}
            >
              {loading ? (
                <div style={{ padding: '8px 12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                  Mencari pegawai...
                </div>
              ) : suggestions.length === 0 ? (
                <div style={{ padding: '8px 12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                  Tidak ada nama yang cocok. Anda dapat mengetik manual.
                </div>
              ) : (
                suggestions.map((item, idx) => (
                  <div
                    key={item.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: idx === activeIndex ? '#f0fdf4' : 'transparent',
                      transition: 'background 100ms',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>{item.name}</strong>
                      {item.role && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: item.role === 'admin' ? '#fef3c7' : '#e0f2fe',
                            color: item.role === 'admin' ? '#92400e' : '#0369a1',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.role}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      <span>NIP: <span className="mono">{item.nip || '-'}</span></span>
                      {item.position ? (
                        <>
                          <span>•</span>
                          <span style={{ color: '#047857', fontWeight: 500 }}>{item.position}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>

        {/* Kolom NIP Atasan dengan Autocomplete Suggestion */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor={nipId} style={{ fontSize: '12px', fontWeight: 600 }}>
              {nipLabel}
            </label>
            <span style={{ fontSize: '10.5px', color: '#64748b' }}>
              18 Digit NIP
            </span>
          </div>
          <input
            ref={nipInputRef}
            id={nipId}
            placeholder="18 digit NIP..."
            value={nipValue}
            autoComplete="off"
            onChange={(e) => handleNipInputChange(e.target.value)}
            onFocus={() => {
              setShowNipDropdown(true);
              setShowNameDropdown(false);
              fetchSuggestions(nipValue);
            }}
            onClick={() => {
              setShowNipDropdown(true);
              setShowNameDropdown(false);
              fetchSuggestions(nipValue);
            }}
            onKeyDown={(e) => handleKeyDown(e, false)}
          />

          {/* Dropdown Suggestions untuk NIP */}
          {showNipDropdown ? (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 2px)',
                left: 0,
                right: 0,
                maxHeight: '220px',
                overflowY: 'auto',
                backgroundColor: '#ffffff',
                border: '1px solid #94a3b8',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                zIndex: 100,
              }}
            >
              {loading ? (
                <div style={{ padding: '8px 12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                  Mencari pegawai...
                </div>
              ) : suggestions.length === 0 ? (
                <div style={{ padding: '8px 12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                  Tidak ada NIP yang cocok. Anda dapat mengetik manual.
                </div>
              ) : (
                suggestions.map((item, idx) => (
                  <div
                    key={item.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: idx === activeIndex ? '#f0fdf4' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono" style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>
                        {item.nip || '(Tanpa NIP)'}
                      </span>
                      <strong style={{ fontSize: '12px', color: '#334155' }}>{item.name}</strong>
                    </div>
                    {item.position ? (
                      <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px' }}>
                        {item.position}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Kolom Jabatan Atasan (Otomatis terisi, bisa diedit manual) */}
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor={positionId} style={{ fontSize: '12px', fontWeight: 600 }}>
            {positionLabel}
          </label>
          {defaultPositionSuggestion && positionValue !== defaultPositionSuggestion ? (
            <button
              type="button"
              className="button-link"
              style={{
                background: 'none',
                border: 'none',
                color: '#0284c7',
                fontSize: '11px',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
              onClick={() => onPositionChange(defaultPositionSuggestion)}
            >
              Gunakan: {defaultPositionSuggestion}
            </button>
          ) : null}
        </div>
        <input
          id={positionId}
          placeholder="Contoh: Kasubbag Tata Usaha / Kepala Kantor"
          value={positionValue}
          onChange={(e) => onPositionChange(e.target.value)}
        />
      </div>
    </fieldset>
  );
}

