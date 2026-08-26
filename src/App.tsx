import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RootShell } from './components/Shell'
import PlayerPicker from './components/PlayerPicker'
import SimklSyncAgent from './components/SimklSyncAgent'
import {
  HomePage, IPTVPage, IPTVWatchPage, ListingPage, MyListPage, NotFoundPage,
  SearchPage, SportsPage, SportsWatchPage, StreamingPage, StatusPage, TitlePage, WatchPage,
} from './pages/Pages'
import SettingsPage from './pages/SettingsPage'
import SimklPage from './pages/SimklPage'
import './styles/globals.css'

export default function App() {
  return <BrowserRouter><RootShell><PlayerPicker/><SimklSyncAgent/><Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/movies" element={<ListingPage type="movie"/>}/>
    <Route path="/series" element={<ListingPage type="series"/>}/>
    <Route path="/search" element={<SearchPage/>}/>
    <Route path="/my-list" element={<MyListPage/>}/>
    <Route path="/iptv" element={<IPTVPage/>}/>
    <Route path="/iptv/watch/:channelId" element={<IPTVWatchPage/>}/>
    <Route path="/sports" element={<SportsPage/>}/>
    <Route path="/streaming" element={<StreamingPage/>}/>
    <Route path="/sports/watch/:matchId" element={<SportsWatchPage/>}/>
    <Route path="/title/:type/:id" element={<TitlePage/>}/>
    <Route path="/watch/:type/:id" element={<WatchPage/>}/>
    <Route path="/watch/:type/:id/:season/:episode" element={<WatchPage/>}/>
    <Route path="/status" element={<StatusPage/>}/>
    <Route path="/settings" element={<SettingsPage/>}/>
    <Route path="/simkl/callback" element={<SimklPage/>}/>
    <Route path="/simkl" element={<SimklPage/>}/>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes></RootShell></BrowserRouter>
}
