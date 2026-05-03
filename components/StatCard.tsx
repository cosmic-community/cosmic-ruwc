export default function StatCard({
  label,
  value,
  icon,
  color = 'blue',
}: {
  label: string
  value: string | number
  icon: string
  color?: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return (
    <div className={`border rounded-xl p-5 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm opacity-80 mt-1">{label}</p>
    </div>
  )
}