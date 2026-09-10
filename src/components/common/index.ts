// Shared UI primitives used by both /create (personal) and /work (corporate).
// One design language; the header chrome is the only themed difference.
export { default as ModeSwitch } from './ModeSwitch';
export { Card } from './Card';
export { Button } from './Button';
export { SectionHeading } from './SectionHeading';
export { ProfileMenu, type ProfileMenuItem } from './ProfileMenu';

// Native-app-styled form controls. These replace the browser's own <select>,
// <input type="date"> and <input type="time">, whose UI is drawn by the OS and
// cannot be themed (and takes over the screen on iOS).
export { default as Select, type SelectOption } from './Select';
export { default as DatePicker } from './DatePicker';
export { default as TimePicker } from './TimePicker';
export { Popover, FieldTrigger } from './Popover';
