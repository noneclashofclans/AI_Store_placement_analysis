import { useContext } from 'react';
import { ThemeContext } from './toggle_theme';

const useTheme = () => useContext(ThemeContext);

export default useTheme; 