/**
 * LazyDatePicker — the react-datepicker chunk behind a dynamic import (N-ENTRY-1).
 * The form kit lazy-loads this module so the date picker and its stylesheet stay out of
 * the entry bundle (the sign-in page never needs them); only a rendered DateField fetches it.
 */
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

export default DatePicker
