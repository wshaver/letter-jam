import { areHomophones } from './homophones';

it('detects homophones across a group', () => {
  expect(areHomophones('to', 'two')).toBe(true);
  expect(areHomophones('too', 'to')).toBe(true);
  expect(areHomophones('ate', 'eight')).toBe(true);
  expect(areHomophones('there', 'their')).toBe(true);
});

it('a word is not its own homophone', () => {
  expect(areHomophones('to', 'to')).toBe(false);
});

it('unrelated words are not homophones', () => {
  expect(areHomophones('cat', 'dog')).toBe(false);
  expect(areHomophones('for', 'from')).toBe(false);
});

it('covers the noun-created homophone groups', () => {
  expect(areHomophones('i', 'eye')).toBe(true);
  expect(areHomophones('would', 'wood')).toBe(true);
});
