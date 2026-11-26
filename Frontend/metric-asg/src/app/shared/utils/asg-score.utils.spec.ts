
import {
  isValidAsgScore
} from './asg-score.utils';

describe('isValidAsgScore', () => {

  it('should accept zero', () => {

    expect(isValidAsgScore(0)).toBeTrue();

  });

  it('should accept the maximum score', () => {

    expect(isValidAsgScore(10)).toBeTrue();

  });

  it('should accept decimal scores', () => {

    expect(isValidAsgScore(7.85)).toBeTrue();

  });

  it('should reject negative scores', () => {

    expect(isValidAsgScore(-1)).toBeFalse();

  });

  it('should reject scores greater than ten', () => {

    expect(isValidAsgScore(10.1)).toBeFalse();

  });

  it('should reject NaN', () => {

    expect(isValidAsgScore(NaN)).toBeFalse();

  });

  it('should reject infinite values', () => {

    expect(isValidAsgScore(Infinity)).toBeFalse();

    expect(isValidAsgScore(-Infinity)).toBeFalse();

  });

  it('should reject null and undefined', () => {

    expect(isValidAsgScore(null)).toBeFalse();

    expect(isValidAsgScore(undefined)).toBeFalse();

  });

  it('should reject numeric strings', () => {

    expect(isValidAsgScore('9.5')).toBeFalse();

  });

  it('should reject non-numeric values', () => {

    expect(isValidAsgScore({})).toBeFalse();

    expect(isValidAsgScore([])).toBeFalse();

    expect(isValidAsgScore(true)).toBeFalse();

  });

});
