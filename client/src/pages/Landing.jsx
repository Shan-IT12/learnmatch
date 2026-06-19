import { Link } from 'react-router-dom'

function Landing() {
  return (
    <div className="min-h-screen bg-orange-50">

      <nav className="flex justify-between items-center px-16 py-5">
        <h1 className="text-2xl font-bold">
          Learn<span className="text-orange-600">Match</span>
        </h1>
        <Link to="/login" className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700">
          Get Started
        </Link>
      </nav>

      <section className="text-center py-24 px-5">
        <h2 className="text-5xl font-bold mb-5">
          The Right Course <span className="text-orange-600">Starts Here.</span>
        </h2>
        <p className="text-lg text-gray-600 max-w-xl mx-auto mb-8">
          A quick assessment of your skills, interests, and personality — personalized recommendations and career pathways, just for you.
        </p>
        <Link to="/register" className="bg-orange-600 text-white px-8 py-4 rounded-lg text-lg hover:bg-orange-700">
          Start Free Assessment
        </Link>
      </section>

    </div>
  );
}

export default Landing;