import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Star } from "lucide-react";
import api from "../api/axios.js";
import Navbar from "../components/ui/Navbar.jsx";
import Footer from "../components/ui/Footer.jsx";
import Card from "../components/ui/Card.jsx";
import BadgeChip from "../components/ui/BadgeChip.jsx";
import Spinner from "../components/ui/Spinner.jsx";

export default function ProviderProfile() {
  const { id } = useParams();
  const [provider, setProvider] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [distribution, setDistribution] = useState({});
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get(`/providers/${id}/badges`),
      api.get(`/reviews/provider/${id}?page=${page}&limit=20`)
    ])
      .then(([providerResponse, reviewResponse]) => {
        if (!active) return;
        setProvider(providerResponse.data.provider);
        setReviews((current) => page === 1 ? reviewResponse.data.reviews : [...current, ...reviewResponse.data.reviews]);
        setDistribution(reviewResponse.data.ratingDistribution);
        setPages(reviewResponse.data.pagination.pages);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Provider profile could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, page]);

  const count = provider?.ratingCount || 0;
  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/app" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> Services</Link>
        {loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading provider profile" /></div> : error ? <p role="alert" className="mt-7 rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : provider && (
          <>
            <Card className="mt-7 p-6 sm:p-8">
              <div className="flex flex-wrap items-start gap-5">
                {provider.user?.avatar ? <img src={provider.user.avatar} alt="" className="h-20 w-20 rounded-full object-cover" /> : <span className="grid h-20 w-20 place-items-center rounded-full bg-accent/10 text-3xl font-semibold text-accent">{provider.user?.name?.slice(0, 1) || "P"}</span>}
                <div className="min-w-0 flex-1"><p className="text-xs font-bold tracking-[0.22em] text-accent">PROFESSIONAL PROFILE</p><h1 className="mt-2 text-3xl font-semibold">{provider.user?.name || "Verified professional"}</h1><div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400"><span className="inline-flex items-center gap-1.5"><Star className="fill-amber-300 text-amber-300" size={16} />{Number(provider.ratingAvg || 0).toFixed(1)} ({count} reviews)</span><span>{provider.jobsDone || 0} jobs completed</span>{provider.verificationStatus === "verified" && <span className="inline-flex items-center gap-1 text-emerald-200"><BadgeCheck size={15} /> Verified</span>}</div></div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">{(provider.badges || []).map((badge, index) => <BadgeChip key={`${badge.name}-${index}`} badge={badge} />)}</div>
              {!!provider.skills?.length && <div className="mt-6"><h2 className="text-sm font-semibold">Skills</h2><div className="mt-2 flex flex-wrap gap-2">{provider.skills.map((skill) => <span key={`${skill.service?._id}-${skill.level}`} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300">{skill.service?.title || "Home service"} · {skill.level}</span>)}</div></div>}
            </Card>
            <section className="mt-9 grid gap-6 md:grid-cols-[260px_1fr]">
              <Card className="h-fit p-5"><h2 className="font-semibold">Rating breakdown</h2><div className="mt-4 space-y-3">{[5, 4, 3, 2, 1].map((rating) => <div key={rating} className="flex items-center gap-3 text-xs"><span className="inline-flex w-7 items-center gap-1 text-slate-400">{rating}<Star size={11} className="fill-amber-300 text-amber-300" /></span><span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-amber-300" style={{ width: `${count ? ((distribution[rating] || 0) / count) * 100 : 0}%` }} /></span><span className="w-7 text-right text-slate-500">{distribution[rating] || 0}</span></div>)}</div></Card>
              <div><h2 className="mb-4 text-xl font-semibold">Customer reviews</h2>{reviews.length ? <><div className="grid gap-3">{reviews.map((review) => <Card key={review._id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{review.customer?.name || "Customer"}</p><p className="mt-1 text-xs text-slate-500">{review.service?.title} · {new Date(review.createdAt).toLocaleDateString()}</p></div><span className="inline-flex items-center gap-1 text-sm text-amber-200"><Star size={14} className="fill-amber-300 text-amber-300" />{review.rating}</span></div>{review.comment && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{review.comment}</p>}{review.tags?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{review.tags.map((tag) => <span key={tag} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">{tag}</span>)}</div>}</Card>)}</div>{page < pages && <button type="button" onClick={() => setPage((current) => current + 1)} className="mt-4 w-full rounded-xl border border-white/10 py-3 text-sm text-slate-300 hover:border-accent/30 hover:text-accent">Load more reviews</button>}</> : <Card className="p-6 text-sm text-slate-400">This professional has not received any reviews yet.</Card>}</div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
