import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from models import Link, LinkRiskPrediction, MLMetricsResponse

class LinkRiskModel:
    """
    ML model using Random Forest to predict link failure risk based on synthetic
    network telemetry: utilization, latency, packet loss, historical failures, and hardware age.
    """
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=50, random_state=42, max_depth=5)
        self.metrics: Dict[str, Any] = {}
        self.is_trained = False
        self._train_synthetic_model()

    def _generate_synthetic_dataset(self, n_samples: int = 1200) -> pd.DataFrame:
        """
        Generates reproducible realistic synthetic telemetry.
        High packet loss, high utilization, excessive latency, or repeat failures increase risk of link failure.
        """
        np.random.seed(42)
        
        # Link utilization (0% to 100%)
        utilization = np.random.uniform(5.0, 98.0, n_samples)
        
        # Latency in ms (1ms to 120ms)
        latency = np.random.exponential(scale=15.0, size=n_samples) + 1.0
        
        # Packet loss (0% to 15%)
        packet_loss = np.random.exponential(scale=1.2, size=n_samples)
        
        # Previous failure count (0 to 6)
        failure_history = np.random.poisson(lam=0.8, size=n_samples)
        
        # Age in months (1 to 60)
        age_months = np.random.uniform(1.0, 60.0, n_samples)

        # Risk scoring function (physics / networking heuristic)
        # Higher score = higher probability of failure
        risk_score = (
            (utilization / 100.0) * 0.35 +
            np.clip(latency / 80.0, 0, 1) * 0.25 +
            np.clip(packet_loss / 5.0, 0, 1) * 0.40 +
            (failure_history / 4.0) * 0.30 +
            (age_months / 48.0) * 0.15
        )
        
        # Add slight noise
        noise = np.random.normal(0, 0.05, n_samples)
        prob = 1 / (1 + np.exp(-4 * (risk_score + noise - 0.75)))
        
        # Binary target: 1 = Failure likely, 0 = Link Healthy
        labels = (prob > 0.5).astype(int)

        df = pd.DataFrame({
            'utilization': utilization,
            'latency': latency,
            'packet_loss': packet_loss,
            'failure_history': failure_history,
            'age_months': age_months,
            'label': labels
        })
        return df

    def _train_synthetic_model(self):
        df = self._generate_synthetic_dataset()
        X = df[['utilization', 'latency', 'packet_loss', 'failure_history', 'age_months']]
        y = df['label']

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)
        self.model.fit(X_train, y_train)

        y_pred = self.model.predict(X_test)
        
        self.metrics = {
            "model_name": "Random Forest Classifier (Synthetic Telemetry)",
            "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
            "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
            "f1_score": round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
            "training_samples": len(df),
            "disclaimer": "Estimates are derived from a Random Forest model trained on synthetic network telemetry for educational demonstration. Real-world validation is advised."
        }
        self.is_trained = True

    def get_metrics(self) -> MLMetricsResponse:
        return MLMetricsResponse(**self.metrics)

    def predict_link_risk(self, link: Link, source_name: str = "", target_name: str = "") -> LinkRiskPrediction:
        """
        Calculates failure probability for a specific network link.
        """
        u = float(link.utilization if link.utilization is not None else 45.0)
        lat = float(link.latency if link.latency is not None else 5.0)
        pl = float(link.packet_loss if link.packet_loss is not None else 0.5)
        fh = int(link.failure_history if link.failure_history is not None else 0)
        age = float(link.age_months if link.age_months is not None else 12.0)

        features_df = pd.DataFrame([{
            'utilization': u,
            'latency': lat,
            'packet_loss': pl,
            'failure_history': fh,
            'age_months': age
        }])
        prob = float(self.model.predict_proba(features_df)[0][1])
        prob_rounded = round(prob, 3)

        if prob >= 0.65:
            level = "High"
            explanation = f"High failure risk: Elevated packet loss ({pl}%), high utilization ({u}%), and history of {fh} failure(s)."
        elif prob >= 0.35:
            level = "Medium"
            explanation = f"Moderate failure risk: Moderate utilization ({u}%) and latency ({lat}ms). Routine monitoring recommended."
        else:
            level = "Low"
            explanation = f"Low failure risk: Link operates within standard operating limits (loss: {pl}%, util: {u}%)."

        return LinkRiskPrediction(
            link_id=link.id,
            source=link.source,
            target=link.target,
            source_name=source_name or link.source,
            target_name=target_name or link.target,
            utilization=u,
            latency=lat,
            packet_loss=pl,
            failure_history=fh,
            age_months=age,
            failure_probability=prob_rounded,
            risk_level=level,
            explanation=explanation
        )

# Global singleton
ml_service = LinkRiskModel()
