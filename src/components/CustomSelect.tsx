'use client'

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface CustomSelectProps {
  options: string[];
  placeholder: string;
  onChange: (option: string) => void;
  value?: string;
  disabled?: boolean;
}

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const MIN_VISIBLE_HEIGHT = 180;
const VIEWPORT_MARGIN = 12;
const PANEL_GAP = 8;

const CustomSelect: React.FC<CustomSelectProps> = ({ options, placeholder, onChange, value, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOptions, setFilteredOptions] = useState<string[]>(options);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setFilteredOptions(
      options.filter((option) =>
        typeof option === "string" && option.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, options]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      if (isDesktop) {
        inputRef.current.focus();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const maxPanelHeight = Math.min(360, viewportHeight - VIEWPORT_MARGIN * 2);
    const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;

    const shouldOpenDown = spaceBelow >= spaceAbove;
    const availableSpace = shouldOpenDown ? spaceBelow : spaceAbove;
    const maxHeight = Math.min(maxPanelHeight, Math.max(MIN_VISIBLE_HEIGHT, availableSpace));

    const downwardTopLimit = viewportHeight - VIEWPORT_MARGIN - maxHeight;
    const top = shouldOpenDown
      ? Math.min(Math.max(rect.bottom + PANEL_GAP, VIEWPORT_MARGIN), downwardTopLimit)
      : Math.max(VIEWPORT_MARGIN, rect.top - PANEL_GAP - maxHeight);

    const width = Math.min(rect.width, viewportWidth - VIEWPORT_MARGIN * 2);
    let left = rect.left;

    if (left + width > viewportWidth - VIEWPORT_MARGIN) {
      left = viewportWidth - VIEWPORT_MARGIN - width;
    }

    if (left < VIEWPORT_MARGIN) {
      left = VIEWPORT_MARGIN;
    }

    setDropdownPosition({
      top,
      left,
      width,
      maxHeight
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updateDropdownPosition();
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleWindowChange = () => {
      updateDropdownPosition();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [isOpen, updateDropdownPosition]);

  const handleSelect = (option: string) => {
    setSearchTerm("");
    setIsOpen(false);
    if (onChange) {
      onChange(option);
    }
  };

  return (
    <div className="relative w-full" aria-disabled={disabled}>
      <div
        className={`border ${isOpen ? 'border-[#90c639] bg-amber-50' : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50'} transition-all duration-200 rounded-xl p-4 bg-white shadow-md ${
          disabled ? 'cursor-not-allowed opacity-60 hover:bg-white hover:border-gray-300' : 'cursor-pointer'
        }`}
        ref={triggerRef}
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((current) => !current);
        }}
      >
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${!value ? 'text-gray-500' : 'text-gray-900'}`}>
            {value || placeholder || "Select an option"}
          </span>
          <span
            className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>
      </div>
      {isOpen && !disabled && isClient && dropdownPosition &&
        createPortal(
          <div className="fixed inset-0 z-[9999]">
            <div
              className="absolute inset-0"
              aria-hidden="true"
              onClick={() => setIsOpen(false)}
            />
            <div
              className="absolute"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="rounded-xl border border-gray-200 bg-white shadow-2xl">
                <div className="border-b border-gray-200 px-4 py-3">
                  <input
                    type="text"
                    ref={inputRef}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search material types..."
                    className="w-full rounded-lg border border-transparent bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-[#90c639]/60 focus:bg-white focus:outline-none focus:text-[#1a3a1a] placeholder-gray-400"
                  />
                </div>
                <div
                  className="custom-scrollbar overflow-y-auto px-2 py-2"
                  style={{ maxHeight: dropdownPosition.maxHeight }}
                >
                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((option) => (
                      <div
                        key={option}
                        className={`mb-1 rounded-xl border border-transparent px-4 py-3 text-sm font-medium transition hover:border-[#90c639]/40 hover:bg-gradient-to-r hover:from-amber-50 hover:to-green-50 hover:text-[#1a3a1a] ${
                          option === value
                            ? 'border-[#90c639] bg-gradient-to-r from-amber-100 to-green-100 text-[#1a3a1a]'
                            : 'bg-white text-gray-800'
                        }`}
                        onClick={() => handleSelect(option)}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option}</span>
                          {option === value && (
                            <svg className="h-4 w-4 text-[#90c639]" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center px-4 py-10 text-center text-gray-500">
                      <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      <p className="text-sm font-medium">No material types found</p>
                      <p className="mt-1 text-xs text-gray-400">Try adjusting your search</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CustomSelect;
