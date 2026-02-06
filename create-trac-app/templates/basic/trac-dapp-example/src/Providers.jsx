import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0F172A' },
    secondary: { main: '#14B8A6' },
    background: { default: '#ECFEFF', paper: '#FFFFFF' },
    text: { primary: '#0F172A' },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily:
      'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#ECFEFF',
          backgroundImage:
            'radial-gradient(circle at 12px 12px, rgba(15,23,42,0.08) 0 2px, transparent 2px)',
          backgroundSize: '24px 24px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.75)',
          borderColor: 'rgba(17, 24, 39, 0.25)',
          borderWidth: 1,
          borderStyle: 'solid',
          backdropFilter: 'blur(6px)',
        },
      },
    },
  },
});

export default function Providers({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
