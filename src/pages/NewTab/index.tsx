import React from "react";
import ReactDOM from "react-dom";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import {
  AppBar,
  Avatar,
  Container,
  Paper,
  Toolbar,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Input,
  FormHelperText,
} from "@mui/material";
import { Box } from "@mui/system";
import Grid2 from "@mui/material/Unstable_Grid2/Grid2";

const theme = createTheme();

const PullRequests: React.FC = () => {
  const [rows, setRows] = React.useState([]);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if ("local" === areaName && changes?.prs?.newValue) {
      setRows(changes.prs.newValue);
    }
  });

  chrome.storage.local.get("prs").then(({ prs = [] }) => {
    setRows(prs);
  });

  return (
    <List dense sx={{ width: "100%", bgcolor: "background.paper" }}>
      {rows.map((row: any) => {
        return (
          <ListItem
            key={row.id}
            // secondaryAction={<Checkbox edge="end" />}
            disablePadding
          >
            <ListItemButton href={row.url} target="_blank">
              <ListItemAvatar>
                <Avatar alt={row.user} src={row.userImage} />
              </ListItemAvatar>
              <ListItemText
                id={row.id}
                primary={row.title}
                secondary={row.description}
              />
              <ListItemText primary="Changes" secondary={row.changes} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
};

async function verifyToken(token: string) {
  const response = await chrome.runtime.sendMessage({
    type: "verifyToken",
    content: token,
  });
  return response === true;
}

async function tryToRefresh() {
  return await chrome.runtime.sendMessage({
    type: "refresh",
  });
}

const TokenForm: React.FC = (props) => {
  const [token, setToken] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function verify() {
    setLoading(true);
    const verified = await verifyToken(token);
    if (!verified) {
      setError("Invalid Credentials");
      setLoading(false);
    }
  }

  return (
    <React.Fragment>
      <Grid2 container spacing={3} justifyContent="center">
        <Grid2 xs="auto">
          <FormControl error={Boolean(error)} variant="standard">
            <InputLabel htmlFor="component-error">Github Token</InputLabel>
            <Input
              id="component-error"
              aria-describedby="component-error-text"
              value={token}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setToken(event.target.value);
              }}
              endAdornment={
                <Button disabled={loading} onClick={verify}>
                  Verify
                </Button>
              }
            />
            {error && (
              <FormHelperText id="component-error-text">{error}</FormHelperText>
            )}
          </FormControl>
        </Grid2>
      </Grid2>
    </React.Fragment>
  );
};

const App: React.FC = () => {
  const [token, setToken] = React.useState("");

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if ("local" === areaName && changes?.token) {
      setToken(changes.token.newValue);
    }
  });

  chrome.storage.local.get("token").then(({ token = "" }) => {
    if (token) {
      tryToRefresh();
    }
    setToken(token);
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar
        position="absolute"
        color="default"
        elevation={0}
        sx={{
          position: "relative",
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Toolbar>
          <Typography variant="h6" color="inherit" noWrap>
            Github PR's
          </Typography>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="md" sx={{ mb: 4 }}>
        <Paper
          variant="outlined"
          sx={{ my: { xs: 3, md: 6 }, p: { xs: 2, md: 3 } }}
        >
          {token ? <PullRequests /> : <TokenForm />}
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
