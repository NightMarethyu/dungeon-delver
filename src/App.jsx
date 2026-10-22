import Builder from './pages/Builder.jsx'
import Landing from './pages/Landing.jsx'
import { useRoute } from './routing.js'

export default function App() {
  const route = useRoute()
  if (route.page === 'edit') return <Builder key={route.id} id={route.id} />
  if (route.page === 'scratch') return <Builder key="scratch" id={null} />
  return <Landing />
}
