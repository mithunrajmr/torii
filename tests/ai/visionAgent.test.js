import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  processVisionOCR,
  fixPanHeuristics,
  maskAadhaarPrivacy,
  computeNameMatchScore,
  evaluateEdgeCasesAndSpecimens,
} from '../../backend/src/ai/visionAgent.js';


// Mock @google/genai module
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn(),
      },
    })),
  };
});

import { GoogleGenAI } from '@google/genai';

describe('Vision Agent — Gemini Multimodal OCR Engine', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('fixPanHeuristics()', () => {
    it('returns valid PAN unchanged', () => {
      expect(fixPanHeuristics('ABCDE1234F')).toBe('ABCDE1234F');
    });

    it('corrects alphanumeric confusions (e.g. lowercase l -> 1, letter O -> 0 in digits)', () => {
      // 5 letters, 4 digits, 1 letter
      // 'ABCD01234F' -> index 4 is digit '0', converted to 'O' -> 'ABCDO1234F'
      expect(fixPanHeuristics('ABCD01234F')).toBe('ABCDO1234F');
    });

    it('corrects letters in 4-digit numeric portion (e.g. O -> 0, I -> 1, S -> 5)', () => {
      // 'ABCDE1O34F' -> index 6 is letter 'O', converted to '0' -> 'ABCDE1034F'
      expect(fixPanHeuristics('ABCDE1O34F')).toBe('ABCDE1034F');
    });

    it('returns null for non-PAN strings that cannot be fixed', () => {
      expect(fixPanHeuristics('INVALID123')).toBeNull();
      expect(fixPanHeuristics(null)).toBeNull();
    });
  });

  describe('maskAadhaarPrivacy()', () => {
    it('masks 12-digit Aadhaar numbers for privacy', () => {
      expect(maskAadhaarPrivacy('123456789012', 'Aadhaar')).toBe('XXXX-XXXX-9012');
      expect(maskAadhaarPrivacy('1234 5678 9012', 'Aadhaar Card')).toBe('XXXX-XXXX-9012');
      expect(maskAadhaarPrivacy('1234-5678-9012', 'UIDAI')).toBe('XXXX-XXXX-9012');
    });

    it('preserves non-Aadhaar ID numbers', () => {
      expect(maskAadhaarPrivacy('ABCDE1234F', 'PAN')).toBe('ABCDE1234F');
      expect(maskAadhaarPrivacy(null, 'PAN')).toBeNull();
    });
  });

  describe('evaluateEdgeCasesAndSpecimens()', () => {
    it('flags specimen/dummy document with XXXXXX and AAAAA0000A as rejected specimen', () => {
      const evalResult = evaluateEdgeCasesAndSpecimens({
        name: 'XXXXXX XXXXXX',
        id_type: 'PAN',
        pan_number: 'AAAAA0000A',
        dob: '01/01/19XX',
        clarity_score: 0.92,
        confidence: 0.95,
      });

      expect(evalResult.is_specimen_or_dummy).toBe(true);
      expect(evalResult.tampering_detected).toBe(true);
      expect(evalResult.clarity_score).toBe(0.0);
      expect(evalResult.confidence).toBe(0.0);
      expect(evalResult.rejection_reason).toMatch(/SPECIMEN_OR_DUMMY_DOCUMENT_DETECTED/);
    });

    it('flags finger/hand obstruction with reduced clarity score', () => {
      const evalResult = evaluateEdgeCasesAndSpecimens({
        name: 'RAVI MEHTA',
        id_type: 'PAN',
        pan_number: 'ABCDE1234F',
        clarity_score: 0.90,
        confidence: 0.90,
        finger_obstruction_detected: true,
      });

      expect(evalResult.tampering_detected).toBe(true);
      expect(evalResult.clarity_score).toBeLessThanOrEqual(0.40);
      expect(evalResult.rejection_reason).toMatch(/HAND_OR_FINGER_OBSTRUCTION_DETECTED/);
    });
  });


  describe('processVisionOCR()', () => {
    it('throws error when GEMINI_API_KEY is not set', async () => {
      delete process.env.GEMINI_API_KEY;
      const buffer = Buffer.from('mock image data');
      await expect(processVisionOCR(buffer, 'image/jpeg')).rejects.toThrow(
        /GEMINI_API_KEY environment variable is not set/
      );
    });

    it('successfully extracts document fields via Gemini SDK', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          name: 'ARJUN SHARMA',
          id_type: 'PAN',
          id_number: 'ARJNS1234A',
          dob: '1990-05-15',
          pan_number: 'ARJNS1234A',
          clarity_score: 0.95,
          confidence: 0.98,
        }),
      });

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }));

      const buffer = Buffer.from('fake image content');
      const result = await processVisionOCR(buffer, 'image/jpeg');

      expect(result).toEqual({
        name: 'ARJUN SHARMA',
        id_type: 'PAN',
        id_number: 'ARJNS1234A',
        dob: '1990-05-15',
        pan_number: 'ARJNS1234A',
        clarity_score: 0.95,
        confidence: 0.98,
        tampering_detected: false,
        rejection_reason: null,
        is_specimen_or_dummy: false,
      });



      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('applies Aadhaar privacy masking when Aadhaar document is processed', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          name: 'PRIYA NAIR',
          id_type: 'Aadhaar',
          id_number: '987654321098',
          dob: '1992-10-20',
          pan_number: null,
          clarity_score: 0.90,
          confidence: 0.92,
        }),
      });

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }));

      const buffer = Buffer.from('fake aadhaar image');
      const result = await processVisionOCR(buffer, 'image/png');

      expect(result.id_number).toBe('XXXX-XXXX-1098');
      expect(result.id_type).toBe('Aadhaar');
    });
  });
});
