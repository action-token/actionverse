import { api } from "~/utils/api"

export default function TestPage() {
    const data = api.fan.creator.getCreators.useQuery()
    return <div><h1>Hello</h1>
    {data.error && <p>{JSON.stringify(data.error)}</p>}
    {JSON.stringify(data.data)}
    {data.isLoading && <p>Loadign..</p>}
    </div>
}