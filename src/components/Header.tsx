export default function Header() {
  return (
    <header className="text-center mb-12">
      <div className="flex items-center justify-center mb-4">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-2xl text-white mr-4">
          🤖
        </div>
        <h1 className="text-4xl font-bold text-gray-800">
          Smart Image Analysis Platform
        </h1>
      </div>
      <p className="text-xl text-gray-600 max-w-2xl mx-auto">
        Claude Sonnet 4を活用した高精度画像・文書分析システム
      </p>
      <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-800 text-sm font-medium">
        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
        Powered by Claude Sonnet 4
      </div>
    </header>
  )
}