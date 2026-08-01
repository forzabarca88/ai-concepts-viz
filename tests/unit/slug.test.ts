import { describe, it, expect } from 'vitest';
import { toSlug, getSectionForSlug } from '../../src/lib/slug';

describe('toSlug', () => {
  it('converts simple strings to lowercase slugs', () => {
    expect(toSlug('Pre-training')).toBe('pre-training');
    expect(toSlug('SFT')).toBe('sft');
    expect(toSlug('Data')).toBe('data');
  });

  it('replaces spaces with hyphens', () => {
    expect(toSlug('Preference Tuning')).toBe('preference-tuning');
    expect(toSlug('Tool Calling')).toBe('tool-calling');
  });

  it('removes special characters', () => {
    expect(toSlug('AI/ML')).toBe('aiml');
    expect(toSlug('model-v2.0')).toBe('model-v20');
    expect(toSlug('hello!world')).toBe('helloworld');
  });

  it('collapses multiple hyphens into one', () => {
    expect(toSlug('  extra   spaces  ')).toBe('extra-spaces');
    expect(toSlug('a--b---c')).toBe('a-b-c');
  });

  it('trims leading and trailing whitespace', () => {
    expect(toSlug('  padded  ')).toBe('padded');
  });

  it('strips leading and trailing hyphens', () => {
    expect(toSlug('-leading')).toBe('leading');
    expect(toSlug('trailing-')).toBe('trailing');
    expect(toSlug('-both-')).toBe('both');
  });
});

describe('getSectionForSlug', () => {
  it('returns correct section for known slugs', () => {
    expect(getSectionForSlug('data')).toBe('core');
    expect(getSectionForSlug('tokenization')).toBe('core');
    expect(getSectionForSlug('parameters')).toBe('core');
    expect(getSectionForSlug('pre-training')).toBe('training');
    expect(getSectionForSlug('sft')).toBe('training');
    expect(getSectionForSlug('preference-tuning')).toBe('training');
  });

  it('returns "other" for unmapped slugs', () => {
    expect(getSectionForSlug('tool-calling')).toBe('other');
    expect(getSectionForSlug('unknown')).toBe('other');
  });
});
