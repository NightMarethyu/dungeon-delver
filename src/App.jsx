import Builder, { ExampleBuilder, SharedBuilder } from './pages/Builder.jsx'
import Handout from './pages/Handout.jsx'
import Landing from './pages/Landing.jsx'
import { useRoute } from './routing.js'

export default function App() {
  const route = useRoute()
  if (route.page === 'edit') return <Builder key={route.id} id={route.id} />
  if (route.page === 'scratch') return <Builder key="scratch" id={null} />
  if (route.page === 'share') return <SharedBuilder key={route.data} data={route.data} />
  if (route.page === 'example') return <ExampleBuilder key={route.id} exampleId={route.id} />
  if (route.page === 'handout') return <Handout key={route.data} data={route.data} />
  return <Landing />
}
